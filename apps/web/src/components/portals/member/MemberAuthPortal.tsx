'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthCredentialsForm } from '@/components/portals/shared/AuthCredentialsForm';
import { PortalFooterLinks } from '@/components/portals/shared/PortalFooterLinks';
import { PORTALS } from '@/components/portals/shared/config';

function MemberLoginForm() {
  const error = useSearchParams().get('error');
  const portal = PORTALS.member;

  return (
    <AuthCredentialsForm
      eyebrow="Learner & Tutor"
      title="Learner and Tutor Login"
      description={portal.description}
      intent={portal.loginIntent!}
      submitLabel="Sign in"
      error={error}
      footer={
        <PortalFooterLinks
          primaryHref={PORTALS.tenant.loginPath}
          primaryLabel="Admin login"
        />
      }
    />
  );
}

export function MemberLoginPortal() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <MemberLoginForm />
    </Suspense>
  );
}
