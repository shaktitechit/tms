'use client';

import { primaryButtonClassName } from '@/components/portals';

export function ContentFormActions({
  submitLabel,
  submitting,
  onCancel,
}: {
  submitLabel: string;
  submitting: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-blue-100 px-4 py-2 text-sm text-slate-600"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={submitting}
        className={`${primaryButtonClassName} sm:w-auto sm:px-6`}
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}
