'use client';

import { useEffect } from 'react';

export function ConfirmDeleteModal({
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirming = false,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !confirming) {
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [confirming, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        disabled={confirming}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-description"
        className="relative z-10 w-full max-w-md rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl sm:p-6"
      >
        <h2 id="confirm-delete-title" className="text-xl font-semibold text-slate-900">
          {title}
        </h2>
        <p id="confirm-delete-description" className="mt-2 text-sm text-slate-500">
          {description}
        </p>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="rounded-full border border-blue-100 px-4 py-2 text-sm text-slate-600 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="rounded-full bg-rose-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-rose-400 disabled:opacity-50"
          >
            {confirming ? `${confirmLabel}…` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
