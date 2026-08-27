import type { NextRequest } from 'next/server';

/**
 * Build an absolute URL for redirects using the browser-facing host.
 * Docker sets HOSTNAME=0.0.0.0 for bind address; using request.url alone
 * would redirect to http://0.0.0.0:3000 and drop localhost cookies.
 */
export function publicUrl(request: NextRequest, pathname: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  url.hash = '';

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const hostHeader = request.headers.get('host')?.trim();
  const candidate = forwardedHost || hostHeader;

  if (candidate && !isBindAllHost(candidate)) {
    url.host = candidate;
  } else if (isBindAllHost(url.hostname)) {
    url.hostname = 'localhost';
  }

  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (proto === 'http' || proto === 'https') {
    url.protocol = `${proto}:`;
  }

  return url;
}

function isBindAllHost(host: string): boolean {
  const hostname = host.replace(/^\[|\]$/g, '').split(':')[0] ?? host;
  return hostname === '0.0.0.0' || hostname === '::' || hostname === '[::]';
}
