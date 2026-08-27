import { type NextRequest, NextResponse } from 'next/server';
import { setFlashCookie } from '@/lib/flash-toast';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = process.env.COOKIE_NAME ?? 'video_session';

function apiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
}

export async function POST(_req: NextRequest): Promise<NextResponse> {
  try {
    await fetch(`${apiBaseUrl()}/api/auth/logout`, {
      method: 'POST',
      cache: 'no-store',
    });
  } catch {
    // still clear local cookie
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
    maxAge: 0,
  });
  setFlashCookie(response, { tone: 'success', message: 'Signed out.' });
  return response;
}
