'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthCredentialsForm } from '@/components/portals/shared/AuthCredentialsForm';
import { PortalFooterLinks } from '@/components/portals/shared/PortalFooterLinks';

function LoginForm() {
  const error = useSearchParams().get('error');

  return (
    <AuthCredentialsForm
      eyebrow="Welcome back"
      title="Sign in"
      description="Admins, tutors, and learners use the same page. You’ll land in your workspace."
      intent="login"
      submitLabel="Sign in"
      error={error}
      showHomeLink={false}
      footer={
        <PortalFooterLinks primaryHref="/register" primaryLabel="Register an organization" />
      }
    />
  );
}

/** Single login for tenant admins, tutors, and learners. */
export function LoginPortal() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
