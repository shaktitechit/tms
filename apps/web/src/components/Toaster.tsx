'use client';

import { useEffect, useMemo } from 'react';
import { takeFlashToasts } from '@/lib/flash-toast';
import { dismissToast, pushToast, selectToasts, type ToastItem, type ToastTone } from '@/store/slices/toast.slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const AUTO_DISMISS_MS: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  error: 6000,
};

const toneClassName: Record<ToastTone, string> = {
  success: 'border-blue-200 bg-white text-accent',
  error: 'border-rose-200 bg-white text-rose-600',
  info: 'border-blue-100 bg-white text-slate-700',
};

export function useToast() {
  const dispatch = useAppDispatch();

  return useMemo(
    () => ({
      success: (message: string) => dispatch(pushToast({ tone: 'success', message })),
      error: (message: string) => dispatch(pushToast({ tone: 'error', message })),
      info: (message: string) => dispatch(pushToast({ tone: 'info', message })),
      dismiss: (id: string) => dispatch(dismissToast(id)),
    }),
    [dispatch],
  );
}

export function Toaster() {
  const items = useAppSelector(selectToasts);
  const toast = useToast();

  useEffect(() => {
    for (const item of takeFlashToasts()) {
      toast[item.tone](item.message);
    }
  }, [toast]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-16 z-[70] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-20 sm:w-[min(calc(100%-2rem),24rem)]"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      dispatch(dismissToast(item.id));
    }, AUTO_DISMISS_MS[item.tone]);
    return () => window.clearTimeout(timeout);
  }, [dispatch, item.id, item.tone]);

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto animate-toast-in rounded-2xl border px-4 py-3 shadow-glow ${toneClassName[item.tone]}`}
    >
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-sm leading-5">{item.message}</p>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => dispatch(dismissToast(item.id))}
          className="rounded-lg px-1.5 text-sm text-slate-400 hover:text-slate-700"
        >
          ×
        </button>
      </div>
    </div>
  );
}
