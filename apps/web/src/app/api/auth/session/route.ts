import { type NextRequest, NextResponse } from 'next/server';
import { publicUrl } from '@/lib/public-url';
import { setFlashCookie } from '@/lib/flash-toast';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = process.env.COOKIE_NAME ?? 'video_session';
const MAX_AGE = 7 * 24 * 60 * 60;

type AuthUser = {
  id: string;
  email: string;
  name: string;
  username: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
};

function apiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

function homeFor(user: AuthUser): string | null {
  const slug = user.tenantSlug?.trim();
  const username = user.username?.trim();
  if (!slug) {
    return null;
  }
  if (user.role === 'tenant') {
    return `/${slug}`;
  }
  if (user.role === 'user') {
    if (!username) {
      return null;
    }
    return `/${slug}/${username}`;
  }
  return null;
}

function claimsFromToken(token: string): Partial<AuthUser> {
  try {
    const segment = token.split('.')[1];
    if (!segment) {
      return {};
    }
    const payload = JSON.parse(
      Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as Record<string, unknown>;
    return {
      role: typeof payload.role === 'string' ? payload.role : undefined,
      tenantSlug: typeof payload.tenantSlug === 'string' ? payload.tenantSlug : undefined,
      username: typeof payload.username === 'string' ? payload.username : undefined,
    };
  } catch {
    return {};
  }
}

function mergeUser(user: AuthUser, token: string): AuthUser {
  const claims = claimsFromToken(token);
  return {
    ...user,
    role: user.role || claims.role || '',
    tenantSlug: user.tenantSlug || claims.tenantSlug || '',
    username: user.username || claims.username || '',
  };
}

function fail(req: NextRequest, path: string, message: string): NextResponse {
  const url = publicUrl(req, path);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url, 303);
}

function withSession(
  req: NextRequest,
  path: string,
  token: string,
  flash: { tone: 'success'; message: string },
): NextResponse {
  const response = NextResponse.redirect(publicUrl(req, path), 303);
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
    maxAge: MAX_AGE,
  });
  setFlashCookie(response, flash);
  return response;
}

async function callAuth(
  path: 'login' | 'register',
  body: Record<string, string>,
): Promise<{ user: AuthUser; token: string } | { error: string }> {
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { error: 'Could not reach the API. Is it running?' };
  }

  const data = (await upstream.json().catch(() => ({}))) as {
    message?: string;
    user?: AuthUser;
    token?: string;
  };

  if (!upstream.ok || !data.user || !data.token) {
    return { error: data.message ?? 'Authentication failed' };
  }
  return { user: data.user, token: data.token };
}

/** Form POST → set cookie → 303 to workspace. Single navigation path. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const form = await req.formData();
  const intent = String(form.get('intent') ?? '');
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const name = String(form.get('name') ?? '').trim();
  const tenantName = String(form.get('tenantName') ?? '').trim();

  if (intent === 'login-tenant' || intent === 'login-user') {
    const portal = intent === 'login-tenant' ? '/login/tenant' : '/login/user';
    const result = await callAuth('login', { email, password });
    if ('error' in result) {
      return fail(req, portal, result.error);
    }
    const want = intent === 'login-tenant' ? 'tenant' : 'user';
    if (result.user.role !== want) {
      return fail(
        req,
        portal,
        want === 'tenant'
          ? 'This portal is for tenant admins. Use member login instead.'
          : 'This portal is for member users. Use tenant login instead.',
      );
    }
    const user = mergeUser(result.user, result.token);
    const dest = homeFor(user);
    if (!dest) {
      return fail(
        req,
        portal,
        want === 'user'
          ? 'Member account is missing a username. Ask a tenant admin to recreate the member, or re-invite them.'
          : 'Tenant workspace slug is missing. Try registering again.',
      );
    }
    return withSession(req, dest, result.token, {
      tone: 'success',
      message: 'Signed in.',
    });
  }

  if (intent === 'register') {
    const body: Record<string, string> = { email, password, name };
    if (tenantName) {
      body.tenantName = tenantName;
    }
    const result = await callAuth('register', body);
    if ('error' in result) {
      return fail(req, '/register', result.error);
    }
    const user = mergeUser(result.user, result.token);
    const dest = homeFor(user);
    if (!dest) {
      return fail(req, '/register', 'Workspace routing failed. Try signing in.');
    }
    return withSession(req, dest, result.token, {
      tone: 'success',
      message: 'Workspace created. You are signed in.',
    });
  }

  return fail(req, '/login', 'Unknown auth action');
}
