'use client';

import { useEffect, type FormEvent, type ReactNode } from 'react';
import { MemberAccess } from '@video/shared';
import {
  Field,
  inputClassName,
  primaryButtonClassName,
} from '@/components/portals';

export type MemberFormState = {
  name: string;
  email: string;
  password: string;
  departmentIds: string[];
  access: MemberAccess;
};

export const emptyMemberForm: MemberFormState = {
  name: '',
  email: '',
  password: '',
  departmentIds: [],
  access: MemberAccess.LEARNER,
};

export function MemberModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
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
        aria-labelledby="member-modal-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="member-modal-title" className="text-xl font-semibold text-slate-900">
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

export function MemberForm({
  form,
  onChange,
  onSubmit,
  submitLabel,
  submitting,
  onCancel,
  error,
  mode,
  departments = [],
  departmentsLoading = false,
  showAccess = true,
}: {
  form: MemberFormState;
  onChange: (form: MemberFormState) => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  submitting: boolean;
  onCancel: () => void;
  error?: string | null;
  mode: 'create' | 'edit';
  departments?: Array<{ id: string; name: string }>;
  departmentsLoading?: boolean;
  showAccess?: boolean;
}) {
  const passwordRequired = mode === 'create';

  function toggleDepartment(departmentId: string) {
    const selected = form.departmentIds.includes(departmentId)
      ? form.departmentIds.filter((id) => id !== departmentId)
      : [...form.departmentIds, departmentId];
    onChange({ ...form, departmentIds: selected });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <Field label="Name">
        <input
          required
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="Alex Rivera"
          className={inputClassName}
        />
      </Field>
      <Field label="Email">
        <input
          type="email"
          required={mode === 'create'}
          disabled={mode === 'edit'}
          value={form.email}
          onChange={(event) => onChange({ ...form, email: event.target.value })}
          placeholder="alex@example.com"
          className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-60`}
        />
      </Field>
      <div>
        <p className="text-sm text-slate-700">Departments</p>
        <div className="mt-1.5 max-h-48 space-y-0.5 overflow-y-auto rounded-xl border border-blue-100 p-1.5">
          {departmentsLoading ? (
            <p className="px-2 py-1.5 text-sm text-slate-400">Loading departments…</p>
          ) : departments.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-slate-400">No departments yet</p>
          ) : (
            departments.map((department) => (
              <label
                key={department.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-blue-50"
              >
                <input
                  type="checkbox"
                  checked={form.departmentIds.includes(department.id)}
                  onChange={() => toggleDepartment(department.id)}
                  className="h-4 w-4 rounded border-blue-200 text-accent accent-accent"
                />
                {department.name}
              </label>
            ))
          )}
        </div>
      </div>
      {showAccess ? (
        <div>
          <p className="text-sm text-slate-700">Access</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(
              [
                { value: MemberAccess.LEARNER, label: 'Learner' },
                { value: MemberAccess.TUTOR, label: 'Tutor' },
              ] as const
            ).map((option) => {
              const selected = form.access === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                    selected
                      ? 'border-accent bg-blue-50 text-slate-900'
                      : 'border-blue-100 text-slate-700 hover:bg-blue-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="member-access"
                    value={option.value}
                    checked={selected}
                    onChange={() => onChange({ ...form, access: option.value })}
                    className="h-4 w-4 accent-accent"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
      <Field label={passwordRequired ? 'Temporary password' : 'New password'}>
        <input
          type="password"
          required={passwordRequired}
          minLength={passwordRequired ? 8 : undefined}
          value={form.password}
          onChange={(event) => onChange({ ...form, password: event.target.value })}
          placeholder={passwordRequired ? 'At least 8 characters' : 'Leave blank to keep current'}
          className={inputClassName}
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
