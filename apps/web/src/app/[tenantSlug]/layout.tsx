'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';

/** Slug check only — no redirects (avoids bounce loops). */
export default function TenantSlugLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantSlug: string }>();
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="px-4 py-8 text-slate-500">Loading…</p>;
  }

  if (!user) {
    return (
      <p className="px-4 py-8 text-slate-500">
        Please{' '}
        <Link href="/login" className="text-accent hover:underline">
          sign in
        </Link>
        .
      </p>
    );
  }

  if (user.tenantSlug !== params.tenantSlug) {
    return (
      <p className="px-4 py-8 text-slate-500">
        Wrong workspace.{' '}
        <Link href={`/${user.tenantSlug}`} className="text-accent hover:underline">
          Open yours
        </Link>
      </p>
    );
  }

  return <>{children}</>;
}
