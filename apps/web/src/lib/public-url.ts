import type { NextRequest } from 'next/server';

/**
 * Absolute URL for browser redirects using the public host and proto.
 *
 * Do not clone `request.nextUrl`: Next.js injects the process listen port
 * (3000) into NextURL, so a TLS reverse proxy becomes
 * `https://example.com:3000/...` after login.
 */
export function publicUrl(request: NextRequest, pathname: string): URL {
  const proto = forwardedProto(request);
  const { hostname, port } = publicHost(request, proto);
  const origin = port ? `${proto}://${hostname}:${port}` : `${proto}://${hostname}`;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const url = new URL(path, `${origin}/`);
  url.search = '';
  url.hash = '';
  return url;
}

function forwardedProto(request: NextRequest): 'http' | 'https' {
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (proto === 'http' || proto === 'https') {
    return proto;
  }
  return request.nextUrl.protocol === 'https:' ? 'https' : 'http';
}

function publicHost(
  request: NextRequest,
  proto: 'http' | 'https',
): { hostname: string; port: string } {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const hostHeader = request.headers.get('host')?.trim();
  const parsed = parseHost(forwardedHost || hostHeader || '');

  if (parsed && !isBindAllHostname(parsed.hostname)) {
    return withPublicPort(parsed, proto);
  }

  const fallback = request.nextUrl.hostname;
  if (fallback && !isBindAllHostname(fallback)) {
    return { hostname: fallback, port: '' };
  }

  return { hostname: 'localhost', port: '' };
}

function withPublicPort(
  parsed: { hostname: string; port: string },
  proto: 'http' | 'https',
): { hostname: string; port: string } {
  if (!parsed.port) {
    return { hostname: parsed.hostname, port: '' };
  }
  if ((proto === 'https' && parsed.port === '443') || (proto === 'http' && parsed.port === '80')) {
    return { hostname: parsed.hostname, port: '' };
  }
  return parsed;
}

function parseHost(value: string): { hostname: string; port: string } | null {
  const host = value.trim();
  if (!host) {
    return null;
  }
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end === -1) {
      return null;
    }
    const hostname = host.slice(1, end);
    const rest = host.slice(end + 1);
    return { hostname, port: rest.startsWith(':') ? rest.slice(1) : '' };
  }
  const colon = host.lastIndexOf(':');
  if (colon > 0 && host.indexOf(':') === colon) {
    return { hostname: host.slice(0, colon), port: host.slice(colon + 1) };
  }
  return { hostname: host, port: '' };
}

function isBindAllHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '');
  return host === '0.0.0.0' || host === '::';
}
