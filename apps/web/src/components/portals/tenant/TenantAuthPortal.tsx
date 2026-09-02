'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthCredentialsForm } from '@/components/portals/shared/AuthCredentialsForm';
import { PortalFooterLinks } from '@/components/portals/shared/PortalFooterLinks';
import { Field, inputClassName } from '@/components/portals/shared/AuthCard';
import { PORTALS } from '@/components/portals/shared/config';

function TenantRegisterForm() {
  const error = useSearchParams().get('error');
  const portal = PORTALS.tenant;

  return (
    <AuthCredentialsForm
      eyebrow="Tenant"
      title="Register your organization"
      description="Creates a tenant workspace and the first tenant-admin account."
      intent={portal.registerIntent!}
      submitLabel="Create tenant"
      error={error}
      footer={<PortalFooterLinks primaryHref="/login" primaryLabel="Already have an account? Sign in" />}
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
  );
}

export function TenantRegisterPortal() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <TenantRegisterForm />
    </Suspense>
  );
}

