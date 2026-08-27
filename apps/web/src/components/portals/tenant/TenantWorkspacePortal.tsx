'use client';

import { useParams } from 'next/navigation';
import { PortalGate } from '@/components/portals/shared/PortalGate';
import type { WorkspaceNavLink } from '@/components/portals/shared/types';
import { WorkspaceShell } from '@/components/portals/shared/WorkspaceShell';

export function TenantWorkspacePortal({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantSlug: string }>();
  const slug = params.tenantSlug;

  const links: WorkspaceNavLink[] = [
    { href: `/${slug}`, label: 'Dashboard', icon: 'dashboard' },
    { href: `/${slug}/videos`, label: 'Library', icon: 'library' },
    { href: `/${slug}/upload`, label: 'Upload', icon: 'upload' },
    { href: `/${slug}/departments`, label: 'Departments', icon: 'departments' },
    { href: `/${slug}/users`, label: 'Members', icon: 'members' },
    { href: `/${slug}/settings`, label: 'Settings', icon: 'settings' },
  ];

  return (
    <PortalGate role="tenant">
      <WorkspaceShell links={links}>{children}</WorkspaceShell>
    </PortalGate>
  );
}
