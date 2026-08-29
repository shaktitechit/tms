'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MemberAccessProvider, useMemberAccess } from '@/components/portals/member/MemberAccess';
import { memberWorkspaceNav } from '@/components/portals/member/memberNav';
import { PortalGate } from '@/components/portals/shared/PortalGate';
import { WorkspaceShell } from '@/components/portals/shared/WorkspaceShell';
import { useGetUserQuery } from '@/store/api';

function MemberWorkspaceContent({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenantSlug: string; userName: string }>();
  const { user } = useMemberAccess();
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

  const links = memberWorkspaceNav({
    tenantSlug: params.tenantSlug,
    userName: params.userName,
    departments: assignedDepartments,
  });

  return <WorkspaceShell links={links}>{children}</WorkspaceShell>;
}

export function MemberWorkspacePortal({ children }: { children: React.ReactNode }) {
  return (
    <PortalGate role="user">
      <MemberAccessProvider>
        <MemberWorkspaceContent>{children}</MemberWorkspaceContent>
      </MemberAccessProvider>
    </PortalGate>
  );
}
