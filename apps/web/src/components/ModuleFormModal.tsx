'use client';

import { useEffect, useRef } from 'react';
import {
  Field,
  inputClassName,
  primaryButtonClassName,
} from '@/components/portals';

export type ModuleFormState = {
  name: string;
  description: string;
  authorName: string;
  authorEmail: string;
  departmentId: string;
  thumbnail: File | null;
};

export const emptyModuleForm: ModuleFormState = {
  name: '',
  description: '',
  authorName: '',
  authorEmail: '',
  departmentId: '',
  thumbnail: null,
};

export function ModuleModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-modal-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="module-modal-title" className="text-xl font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-blue-100 px-3 py-1 text-sm text-slate-500 hover:text-accent"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModuleForm({
  form,
  onChange,
  onSubmit,
  submitLabel,
  submitting,
  onCancel,
  thumbnailLabel = 'Thumbnail',
  existingThumbnailUrl,
  departments = [],
  departmentsLoading = false,
  departmentLocked = false,
  error,
}: {
  form: ModuleFormState;
  onChange: (form: ModuleFormState) => void;
  onSubmit: (event: React.FormEvent) => void;
  submitLabel: string;
  submitting: boolean;
  onCancel: () => void;
  thumbnailLabel?: string;
  existingThumbnailUrl?: string | null;
  departments?: Array<{ id: string; name: string }>;
  departmentsLoading?: boolean;
  departmentLocked?: boolean;
  error?: string | null;
}) {
  const thumbRef = useRef<HTMLInputElement>(null);
  const lockedDepartment = departments.find((item) => item.id === form.departmentId);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <Field label="Name">
        <input
          required
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="Tutorials"
          className={inputClassName}
        />
      </Field>
      <Field label="Description">
        <input
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          placeholder="Optional"
          className={inputClassName}
        />
      </Field>
      <Field label="Department">
        {departmentLocked ? (
          <input
            readOnly
            value={lockedDepartment?.name ?? 'Selected department'}
            className={`${inputClassName} cursor-not-allowed bg-slate-50 text-slate-600`}
          />
        ) : (
          <select
            value={form.departmentId}
            onChange={(event) => onChange({ ...form, departmentId: event.target.value })}
            disabled={departmentsLoading}
            className={inputClassName}
          >
            <option value="">No department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Author name">
        <input
          required
          value={form.authorName}
          onChange={(event) => onChange({ ...form, authorName: event.target.value })}
          placeholder="Jane Doe"
          className={inputClassName}
        />
      </Field>
      <Field label="Author email">
        <input
          type="email"
          required
          value={form.authorEmail}
          onChange={(event) => onChange({ ...form, authorEmail: event.target.value })}
          placeholder="jane@example.com"
          className={inputClassName}
        />
      </Field>
      <Field label={thumbnailLabel}>
        {existingThumbnailUrl ? (
          <div className="mb-3 overflow-hidden rounded-xl border border-blue-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existingThumbnailUrl}
              alt="Current thumbnail"
              className="aspect-video w-full object-cover"
            />
          </div>
        ) : null}
        <input
          ref={thumbRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) =>
            onChange({ ...form, thumbnail: event.target.files?.[0] ?? null })
          }
          className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:text-accent"
        />
      </Field>
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
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
