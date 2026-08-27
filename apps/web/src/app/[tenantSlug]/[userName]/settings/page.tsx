'use client';

import { useState } from 'react';
import {
  Field,
  inputClassName,
  primaryButtonClassName,
} from '@/components/portals';
import { useToast } from '@/components/Toaster';
import { useAuth } from '@/lib/auth';
import {
  getErrorMessage,
  useGetTenantMeQuery,
  useUpdateUserMutation,
} from '@/store/api';

export default function MemberSettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { data } = useGetTenantMeQuery(undefined, { skip: !user });
  const [updateUser, { isLoading: saving }] = useUpdateUserMutation();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function onUpdatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    try {
      await updateUser({ id: user.id, body: { password: newPassword } }).unwrap();
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated.');
    } catch (err) {
      setPasswordError(getErrorMessage(err, 'Could not update password'));
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Settings</h1>
        <p className="mt-2 text-slate-500">Your profile in this workspace.</p>
      </div>

      <section className="space-y-4 rounded-2xl border border-blue-100 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <div className="space-y-4">
          <Row label="Name" value={user?.name ?? '—'} />
          <Row label="Username" value={user?.username ? `@${user.username}` : '—'} />
          <Row label="Email" value={user?.email ?? '—'} />
          <Row label="Role" value={user?.role ?? '—'} capitalize />
          <Row label="Access" value={user?.access ?? '—'} capitalize />
          <Row label="Workspace" value={data?.tenant.name ?? user?.tenantSlug ?? '—'} />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-blue-100 bg-white p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Update password</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose a new sign-in password for this account.
          </p>
        </div>
        <form onSubmit={(event) => void onUpdatePassword(event)} className="space-y-4">
          <Field label="New password">
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="At least 8 characters"
              className={inputClassName}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="Repeat new password"
              className={inputClassName}
            />
          </Field>
          {passwordError ? <p className="text-sm text-rose-600">{passwordError}</p> : null}
          <button
            type="submit"
            disabled={saving || !user}
            className={`${primaryButtonClassName} sm:w-auto sm:px-8`}
          >
            {saving ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-blue-50 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={`break-all text-sm text-slate-900 ${capitalize ? 'capitalize' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
