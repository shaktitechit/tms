'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthCredentialsForm } from '@/components/portals/shared/AuthCredentialsForm';
import { PortalFooterLinks } from '@/components/portals/shared/PortalFooterLinks';
import { Field, inputClassName } from '@/components/portals/shared/AuthCard';
import { PORTALS } from '@/components/portals/shared/config';

function TenantLoginForm() {
  const error = useSearchParams().get('error');
  const portal = PORTALS.tenant;

  return (
    <AuthCredentialsForm
      eyebrow="Admin"
      title="Admin Login"
      description={portal.description}
      intent={portal.loginIntent!}
      submitLabel="Sign in"
      error={error}
      footer={
        <PortalFooterLinks
          primaryHref={PORTALS.member.loginPath}
          primaryLabel="Learner and Tutor login"
        />
      }
    />
  );
}

export function TenantLoginPortal() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <TenantLoginForm />
    </Suspense>
  );
}

function TenantRegisterForm() {
  const error = useSearchParams().get('error');
  const portal = PORTALS.tenant;

  return (
    <>
      <AuthCredentialsForm
        eyebrow="Tenant"
        title="Register your organization"
        description="Creates a tenant workspace and the first tenant-admin account."
        intent={portal.registerIntent!}
        submitLabel="Create tenant"
        error={error}
        footer={
          <PortalFooterLinks
            primaryHref={portal.loginPath}
            primaryLabel="Admin login"
            secondaryHref={PORTALS.member.loginPath}
            secondaryLabel="Learner and Tutor login"
          />
        }
      >
        <Field label="Organization name">
          <input
            name="tenantName"
            required
            placeholder="Acme Media"
            className={inputClassName}
          />
        </Field>
        <Field label="Admin name">
          <input name="name" required className={inputClassName} />
        </Field>
      </AuthCredentialsForm>
      <p className="mx-auto mt-4 max-w-md px-2 text-center text-sm text-slate-500">
        Members are invited by a tenant admin from the dashboard.{' '}
        <Link href={PORTALS.public.loginPath} className="text-accent hover:underline">
          Choose login
        </Link>
      </p>
    </>
  );
}

export function TenantRegisterPortal() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <TenantRegisterForm />
    </Suspense>
  );
}
