'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useGetTenantMeQuery } from '@/store/api';
import { PORTALS } from '@/components/portals/shared/config';
import { TenantBrandMark } from '@/components/TenantBrandMark';

export function PublicNavbar() {
  const { user, loading, logout, dashboardPath } = useAuth();
  const { data: tenantData } = useGetTenantMeQuery(undefined, { skip: !user });

  const brandLabel = user
    ? (tenantData?.tenant.name ?? user.tenantSlug ?? 'Workspace')
    : PORTALS.public.label;
  const brandHref = user ? dashboardPath : '/';

  return (
    <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16">
        <Link href={brandHref} className="flex min-w-0 items-center gap-2 font-semibold tracking-tight text-slate-900">
          <TenantBrandMark name={brandLabel} logoUrl={user ? tenantData?.tenant.logoUrl : null} />
          <span className="max-w-[9rem] truncate sm:max-w-xs">{brandLabel}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
          {loading ? (
            <span className="text-slate-400">…</span>
          ) : user ? (
            <>
              <Link
                href={dashboardPath}
                className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-slate-700 hover:bg-blue-50"
              >
                <span className="sm:hidden">Dashboard</span>
                <span className="hidden sm:inline">Open dashboard</span>
              </Link>
              <button
                type="button"
                className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-slate-700 hover:bg-blue-50"
                onClick={async () => {
                  try {
                    await logout();
                  } catch {
                    // still leave the app shell
                  }
                  window.location.assign('/');
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href={PORTALS.public.loginPath}
              className="rounded-full bg-accent px-4 py-1.5 font-medium text-white hover:bg-accent-dim"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
