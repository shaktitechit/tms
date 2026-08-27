'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PortalGate } from '@/components/portals/shared/PortalGate';
import type { WorkspaceNavLink } from '@/components/portals/shared/types';
import { WorkspaceShell } from '@/components/portals/shared/WorkspaceShell';
import { departmentDetailPath } from '@/lib/roles';
import { useGetUserQuery } from '@/store/api';

function MemberWorkspaceContent({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantSlug: string; userName: string }>();
  const { user } = useAuth();
  const base = `/${params.tenantSlug}/${params.userName}`;
  const { data: memberData } = useGetUserQuery(user?.id ?? '', { skip: !user?.id });

  if (user && user.username !== params.userName) {
    return (
      <p className="p-6 text-slate-500">
        Wrong member URL.{' '}
        <Link
          href={`/${user.tenantSlug}/${user.username}`}
          className="text-accent hover:underline"
        >
          Open your dashboard
        </Link>
      </p>
    );
  }

  const assignedDepartments = (memberData?.user.departments ?? []).filter(
    (department): department is { id: string; name: string; slug: string } =>
      Boolean(department.slug),
  );

  const links: WorkspaceNavLink[] = [
    { href: base, label: 'Dashboard', icon: 'dashboard' },
    ...assignedDepartments.map((department) => ({
      href: departmentDetailPath(params.tenantSlug, department.slug, params.userName),
      label: department.name,
      icon: 'departments' as const,
    })),
    { href: `${base}/settings`, label: 'Settings', icon: 'settings' },
  ];

  return <WorkspaceShell links={links}>{children}</WorkspaceShell>;
}

export function MemberWorkspacePortal({ children }: { children: React.ReactNode }) {
  return (
    <PortalGate role="user">
      <MemberWorkspaceContent>{children}</MemberWorkspaceContent>
    </PortalGate>
  );
}
