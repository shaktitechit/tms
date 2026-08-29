'use client';

import Link from 'next/link';
import type { AppRole } from '@/lib/roles';
import { useAuth } from '@/lib/auth';
import { PORTALS } from '@/components/portals/shared/config';

/**
 * UI gate only — never navigates. Navigation loops were caused by
 * router.replace fighting middleware + login redirects.
 */
export function PortalGate({
  role,
  children,
}: {
  role: AppRole;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const portal = role === 'tenant' ? PORTALS.tenant : PORTALS.member;

  if (loading) {
    return <p className="text-slate-500">Loading…</p>;
  }

  if (!user) {
    return (
      <p className="text-slate-500">
        Please{' '}
        <Link href={portal.loginPath} className="text-accent hover:underline">
          sign in
        </Link>{' '}
        to continue.
      </p>
    );
  }

  if (String(user.role ?? '').toLowerCase() !== role) {
    return (
      <p className="text-slate-500">
        This area is for {portal.label.toLowerCase()} accounts.{' '}
        <Link href="/" className="text-accent hover:underline">
          Go home
        </Link>
      </p>
    );
  }

  return <>{children}</>;
}
