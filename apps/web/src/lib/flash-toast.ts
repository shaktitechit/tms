import type { NextResponse } from 'next/server';
import type { ToastTone } from '@/store/slices/toast.slice';

export const FLASH_COOKIE = 'st_stream_flash';

export type FlashToast = {
  tone: ToastTone;
  message: string;
};

export function serializeFlash(toast: FlashToast): string {
  return `${toast.tone}:${toast.message}`;
}

export function parseFlash(raw: string): FlashToast | null {
  const value = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  const separator = value.indexOf(':');
  if (separator <= 0) {
    return null;
  }
  const tone = value.slice(0, separator);
  const message = value.slice(separator + 1).trim();
  if ((tone !== 'success' && tone !== 'error' && tone !== 'info') || !message) {
    return null;
  }
  return { tone, message };
}

export function setFlashCookie(response: NextResponse, toast: FlashToast): void {
  response.cookies.set(FLASH_COOKIE, serializeFlash(toast), {
    path: '/',
    maxAge: 30,
    sameSite: 'lax',
    httpOnly: false,
    secure: false,
  });
}

export function takeFlashToasts(): FlashToast[] {
  if (typeof document === 'undefined') {
    return [];
  }
  const prefix = `${FLASH_COOKIE}=`;
  const part = document.cookie.split('; ').find((row) => row.startsWith(prefix));
  if (!part) {
    return [];
  }
  const parsed = parseFlash(part.slice(prefix.length));
  document.cookie = `${FLASH_COOKIE}=; path=/; max-age=0`;
  return parsed ? [parsed] : [];
}
