'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Field,
  inputClassName,
  primaryButtonClassName,
} from '@/components/portals';
import { TenantBrandMark } from '@/components/TenantBrandMark';
import { useToast } from '@/components/Toaster';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import {
  getErrorMessage,
  useGetTenantMeQuery,
  useUpdateTenantMeMutation,
  useUpdateUserMutation,
} from '@/store/api';

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-blue-50 py-3 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="break-all text-sm text-slate-900 sm:text-right">{value}</span>
    </div>
  );
}

export default function TenantSettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { data, isLoading } = useGetTenantMeQuery();
  const [updateTenant, { isLoading: savingOrg }] = useUpdateTenantMeMutation();
  const [updateUser, { isLoading: savingProfile }] = useUpdateUserMutation();

  const [orgName, setOrgName] = useState('');
  const [orgLogo, setOrgLogo] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [profileName, setProfileName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.tenant.name) {
      setOrgName(data.tenant.name);
    }
  }, [data?.tenant.name]);

  useEffect(() => {
    if (user?.name) {
      setProfileName(user.name);
    }
  }, [user?.name]);

  useEffect(() => {
    if (!orgLogo) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(orgLogo);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [orgLogo]);

  async function onSaveOrganisation(event: React.FormEvent) {
    event.preventDefault();
    setOrgError(null);
    try {
      await updateTenant({ name: orgName, logo: orgLogo }).unwrap();
      setOrgLogo(null);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      toast.success('Organisation updated.');
    } catch (err) {
      setOrgError(getErrorMessage(err, 'Could not update organisation'));
    }
  }

  async function onSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setProfileError(null);

    const trimmedName = profileName.trim();
    if (!trimmedName) {
      setProfileError('Name is required.');
      return;
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        setProfileError('Password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileError('Passwords do not match.');
        return;
      }
    }

    try {
      const body: { name: string; password?: string } = { name: trimmedName };
      if (newPassword) {
        body.password = newPassword;
      }
      await updateUser({ id: user.id, body }).unwrap();
      setNewPassword('');
      setConfirmPassword('');
      toast.success(newPassword ? 'Profile and password updated.' : 'Profile updated.');
    } catch (err) {
      setProfileError(getErrorMessage(err, 'Could not update profile'));
    }
  }

  if (isLoading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  const tenant = data?.tenant;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Settings</h1>
        <p className="mt-1 text-slate-500">Manage your organisation and admin account.</p>
      </div>

      <SettingsSection
        title="Organisation information"
        description="Workspace details visible to your team."
      >
        <div className="rounded-xl border border-blue-50 bg-blue-50/50 px-4">
          <InfoRow label="Workspace URL" value={tenant ? `/${tenant.slug}` : '—'} />
          <InfoRow
            label="Created"
            value={tenant?.createdAt ? formatDate(tenant.createdAt) : '—'}
          />
          <InfoRow label="Tenant ID" value={tenant?.id ?? '—'} />
        </div>
        <form onSubmit={(event) => void onSaveOrganisation(event)} className="space-y-4">
          <Field label="Organisation name">
            <input
              required
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
              className={inputClassName}
            />
          </Field>
          <Field label="Organisation logo">
            <div className="flex items-center gap-4">
              <TenantBrandMark
                name={orgName || tenant?.name || 'Organisation'}
                logoUrl={logoPreviewUrl ?? tenant?.logoUrl}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => setOrgLogo(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:text-accent"
                />
                <p className="mt-1 text-xs text-slate-400">
                  JPEG, PNG, WebP or GIF. Max 5 MB.
                </p>
              </div>
            </div>
          </Field>
          {orgError ? <p className="text-sm text-rose-600">{orgError}</p> : null}
          <button
            type="submit"
            disabled={savingOrg}
            className={`${primaryButtonClassName} sm:w-auto sm:px-8`}
          >
            {savingOrg ? 'Saving…' : 'Save organisation'}
          </button>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Admin information"
        description="Your tenant admin account details."
      >
        <div className="rounded-xl border border-blue-50 bg-blue-50/50 px-4">
          <InfoRow label="Name" value={user?.name ?? '—'} />
          <InfoRow label="Email" value={user?.email ?? '—'} />
          <InfoRow label="Username" value={user?.username ? `@${user.username}` : '—'} />
          <InfoRow label="Role" value={user?.role ?? '—'} />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Update profile"
        description="Change your display name or sign-in password."
      >
        <form onSubmit={(event) => void onSaveProfile(event)} className="space-y-4">
          <Field label="Display name">
            <input
              required
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              className={inputClassName}
            />
          </Field>
          <Field label="New password">
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              placeholder="Leave blank to keep current password"
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
              placeholder="Repeat new password"
              className={inputClassName}
            />
          </Field>
          {profileError ? <p className="text-sm text-rose-600">{profileError}</p> : null}
          <button
            type="submit"
            disabled={savingProfile || !user}
            className={`${primaryButtonClassName} sm:w-auto sm:px-8`}
          >
            {savingProfile ? 'Saving…' : 'Update profile'}
          </button>
        </form>
      </SettingsSection>
    </div>
  );
}
