'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useGetTenantMeQuery } from '@/store/api';
import { Sidebar } from '@/components/portals/shared/Sidebar';
import { WorkspaceBackLink } from '@/components/portals/shared/WorkspaceBackLink';
import type { WorkspaceNavLink } from '@/components/portals/shared/types';

export type { WorkspaceNavLink };

const SIDEBAR_COLLAPSED_KEY = 'workspace-sidebar-collapsed';

/** Full-screen workspace shell shared by tenant and member portals. */
export function WorkspaceShell({
  links,
  children,
}: {
  links: WorkspaceNavLink[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout, dashboardPath } = useAuth();
  const { data: tenantData } = useGetTenantMeQuery(undefined, { skip: !user });
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const brand = tenantData?.tenant.name ?? user?.tenantSlug ?? 'Workspace';
  const logoUrl = tenantData?.tenant.logoUrl;
  const homeHref = links[0]?.href ?? dashboardPath;

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNavOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden overscroll-none bg-ink-950">
      <Sidebar
        brand={brand}
        logoUrl={logoUrl}
        homeHref={homeHref}
        links={links}
        open={navOpen}
        collapsed={collapsed}
        onClose={() => setNavOpen(false)}
        onToggleCollapsed={() => {
          setCollapsed((current) => {
            const next = !current;
            try {
              window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
            } catch {
              // ignore storage errors
            }
            return next;
          });
        }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 flex h-14 shrink-0 items-center justify-end gap-3 border-b border-blue-100 bg-white/90 px-3 backdrop-blur-xl sm:h-16 sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="mr-auto inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 text-accent md:hidden"
            onClick={() => setNavOpen(true)}
          >
            <MenuIcon />
          </button>
          <ProfileBox
            name={user?.name ?? 'Account'}
            role={user?.role ?? ''}
            access={user?.access}
            email={user?.email}
            onLogout={async () => {
              try {
                await logout();
              } catch {
                // still leave the app shell
              }
              window.location.assign('/');
            }}
          />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8">
          <WorkspaceBackLink />
          {children}
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
    </svg>
  );
}

function ProfileBox({
  name,
  role,
  access,
  email,
  onLogout,
}: {
  name: string;
  role: string;
  access?: string | null;
  email?: string;
  onLogout: () => void | Promise<void>;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const details = [role, access, email].filter(Boolean).join(' · ');

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 py-1 pl-1 pr-2 sm:gap-3 sm:py-1.5 sm:pl-1.5 sm:pr-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white sm:h-9 sm:w-9">
        {initial}
      </span>
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        <p className="max-w-[12rem] truncate text-xs capitalize text-slate-500 lg:max-w-xs">
          {details}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void onLogout()}
        className="rounded-lg border border-blue-100 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-blue-50 sm:px-2.5"
      >
        Log out
      </button>
    </div>
  );
}
