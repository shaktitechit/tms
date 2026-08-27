import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

function apiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

/** Collect upstream Set-Cookie values (Node fetch may expose getSetCookie). */
function upstreamSetCookies(upstream: Response): string[] {
  const headers = upstream.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') {
    const list = headers.getSetCookie();
    if (list.length > 0) {
      return list;
    }
  }
  const single = upstream.headers.get('set-cookie');
  return single ? [single] : [];
}

/**
 * Apply upstream Set-Cookie onto the Next response via the cookies API.
 * Appending raw headers alone is flaky under Next middleware / undici.
 */
function applySetCookies(response: NextResponse, rawCookies: string[]): void {
  for (const raw of rawCookies) {
    // Browsers reject Secure cookies on http://localhost; strip Domain so the
    // cookie binds to the web host (not the internal API hostname).
    const rewritten = raw
      .replace(/;\s*Secure/gi, '')
      .replace(/;\s*Domain=[^;]*/gi, '');

    const segments = rewritten.split(';').map((part) => part.trim()).filter(Boolean);
    const first = segments[0];
    if (!first) {
      continue;
    }
    const eq = first.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();

    const options: {
      path?: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'lax' | 'strict' | 'none';
      maxAge?: number;
      expires?: Date;
    } = {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    };

    for (const segment of segments.slice(1)) {
      const sep = segment.indexOf('=');
      const key = (sep === -1 ? segment : segment.slice(0, sep)).trim().toLowerCase();
      const attr = sep === -1 ? '' : segment.slice(sep + 1).trim();
      if (key === 'path' && attr) {
        options.path = attr;
      } else if (key === 'httponly') {
        options.httpOnly = true;
      } else if (key === 'secure') {
        options.secure = true;
      } else if (key === 'samesite' && attr) {
        const site = attr.toLowerCase();
        if (site === 'lax' || site === 'strict' || site === 'none') {
          options.sameSite = site;
        }
      } else if (key === 'max-age' && attr) {
        const maxAge = Number(attr);
        if (Number.isFinite(maxAge)) {
          options.maxAge = maxAge;
        }
      } else if (key === 'expires' && attr) {
        const expires = new Date(attr);
        if (!Number.isNaN(expires.getTime())) {
          options.expires = expires;
        }
      }
    }

    response.cookies.set(name, value, options);
  }
}

async function proxy(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const target = new URL(`${apiBaseUrl()}/api/${pathSegments.join('/')}`);
  target.search = req.nextUrl.search;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream unavailable';
    return NextResponse.json(
      {
        success: false,
        message: `API proxy failed: ${message}`,
        code: 'PROXY_ERROR',
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === 'set-cookie') {
      return;
    }
    responseHeaders.set(key, value);
  });

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });

  applySetCookies(response, upstreamSetCookies(upstream));
  return response;
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path } = await context.params;
  return proxy(req, path ?? []);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
