'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CollapseIcon, NavIcon } from '@/components/portals/shared/NavIcons';
import type { WorkspaceNavLink } from '@/components/portals/shared/types';
import { TenantBrandMark } from '@/components/TenantBrandMark';

export function Sidebar({
  brand,
  logoUrl,
  homeHref,
  links,
  open,
  collapsed,
  onClose,
  onToggleCollapsed,
}: {
  brand: string;
  logoUrl?: string | null;
  homeHref: string;
  links: WorkspaceNavLink[];
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const dashboardHref = links[0]?.href;

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18rem,calc(100vw-2.5rem))] shrink-0 flex-col overflow-hidden border-r border-blue-100 bg-white shadow-glow transition-[width,transform] duration-200 md:static md:z-auto md:h-full md:translate-x-0 md:shadow-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-[4.5rem]' : 'md:w-60'}`}
      >
        <div
          className={`flex shrink-0 border-b border-blue-100 ${
            collapsed
              ? 'items-center justify-between px-4 py-4 md:flex-col md:gap-2 md:px-2 md:py-3'
              : 'items-center justify-between gap-2 px-4 py-4 md:px-5 md:py-5'
          }`}
        >
          <Link
            href={homeHref}
            onClick={onClose}
            title={brand}
            className="flex min-w-0 items-center gap-2 font-semibold tracking-tight text-slate-900"
          >
            <TenantBrandMark name={brand} logoUrl={logoUrl} />
            <span className={`truncate ${collapsed ? 'md:hidden' : ''}`}>{brand}</span>
          </Link>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 text-slate-500 md:hidden"
          >
            ×
          </button>
          <button
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={onToggleCollapsed}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 text-slate-500 hover:bg-blue-50 hover:text-accent md:inline-flex"
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>
        <nav className={`flex flex-1 flex-col gap-1 overflow-y-auto p-3 ${collapsed ? 'md:items-center md:px-2' : ''}`}>
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== dashboardHref && pathname.startsWith(`${link.href}/`)) ||
              (link.label === 'Library' && pathname.includes('/watch/'));
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                title={link.label}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  collapsed ? 'md:h-10 md:w-10 md:justify-center md:gap-0 md:px-0 md:py-0' : ''
                } ${
                  active
                    ? 'bg-blue-50 font-medium text-accent'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-accent'
                }`}
              >
                <NavIcon name={link.icon} />
                <span className={collapsed ? 'md:sr-only' : undefined}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
