import { NextResponse, type NextRequest } from 'next/server';
import { publicUrl } from '@/lib/public-url';

const COOKIE_NAME = process.env.COOKIE_NAME ?? 'video_session';

const RESERVED_ROOT = new Set([
  'api',
  'login',
  'register',
  'watch',
  'upload',
  'videos',
  'dashboard',
  '_next',
]);

const TENANT_SECTIONS = new Set([
  'videos',
  'audios',
  'upload',
  'users',
  'departments',
  'settings',
  'watch',
]);

function publicRedirect(
  request: NextRequest,
  pathname: string,
): NextResponse {
  return NextResponse.redirect(publicUrl(request, pathname));
}

function hasSessionCookie(request: NextRequest): boolean {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  return Boolean(token && token.split('.').length === 3);
}

function decodeSession(request: NextRequest): {
  home: string | null;
  role: string | null;
} {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return { home: null, role: null };
  }
  try {
    const segment = token.split('.')[1];
    if (!segment) {
      return { home: null, role: null };
    }
    const payload = JSON.parse(
      atob(segment.replace(/-/g, '+').replace(/_/g, '/')),
    ) as Record<string, unknown>;
    const role = typeof payload.role === 'string' ? payload.role : null;
    const tenantSlug = typeof payload.tenantSlug === 'string' ? payload.tenantSlug : null;
    const username = typeof payload.username === 'string' ? payload.username : null;
    if (!tenantSlug || !role) {
      return { home: null, role };
    }
    if (role === 'tenant') {
      return { home: `/${tenantSlug}`, role };
    }
    if (role === 'user' && username) {
      return { home: `/${tenantSlug}/${username}`, role };
    }
    return { home: null, role };
  } catch {
    return { home: null, role: null };
  }
}

function decodeHome(request: NextRequest): string | null {
  return decodeSession(request).home;
}

/**
 * Minimal gate only:
 * - legacy /dashboard|/videos|/upload → workspace home when cookie present
 * - /{tenantSlug}/… requires a session cookie
 * - never redirect authenticated users off /login (avoids bounce loops)
 * - no role checks here (layouts handle UI; API enforces auth)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const parts = pathname.split('/').filter(Boolean);
  const authed = hasSessionCookie(request);

  if (pathname === '/' || parts[0] === 'watch') {
    if (parts[0] === 'watch' && parts[1]) {
      if (!authed) {
        return publicRedirect(request, '/login');
      }
      const home = decodeHome(request);
      if (home) {
        return publicRedirect(request, `${home}/watch/${parts[1]}`);
      }
    }
    return NextResponse.next();
  }

  if (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/register'
  ) {
    return NextResponse.next();
  }

  if (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/upload' ||
    pathname === '/videos' ||
    pathname.startsWith('/videos/')
  ) {
    if (!authed) {
      const toUser = pathname.startsWith('/dashboard/user');
      return publicRedirect(request, toUser ? '/login/user' : '/login/tenant');
    }
    const { home } = decodeSession(request);
    const workspaceHome = home ?? '/';
    if (pathname === '/upload') {
      return publicRedirect(request, `${workspaceHome}/upload`);
    }
    if (pathname === '/videos' || pathname.startsWith('/videos/')) {
      const id = pathname.match(/^\/videos\/([^/]+)$/)?.[1];
      return publicRedirect(request, id ? `${workspaceHome}/videos/${id}` : `${workspaceHome}/videos`);
    }
    return publicRedirect(request, workspaceHome);
  }

  if (parts.length >= 1 && !RESERVED_ROOT.has(parts[0]!)) {
    if (!authed) {
      const looksLikeUser =
        parts.length >= 2 && !TENANT_SECTIONS.has(parts[1]!);
      return publicRedirect(
        request,
        looksLikeUser ? '/login/user' : '/login/tenant',
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\..*).*)'],
};
