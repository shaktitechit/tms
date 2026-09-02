'use client';

import { DepartmentsListView } from '@/components/DepartmentsListView';
import { useAuth } from '@/lib/auth';
import { useMemberWorkspace } from '@/lib/member-workspace';
import { departmentDetailPath } from '@/lib/roles';
import { useGetUserQuery } from '@/store/api';

export default function MemberDepartmentsPage() {
  const { tenantSlug, userName, layer } = useMemberWorkspace();
  const { user } = useAuth();
  const { data } = useGetUserQuery(user?.id ?? '', { skip: !user?.id });

  return (
    <DepartmentsListView
      departmentIds={data?.user.departmentIds ?? []}
      detailHref={(department) =>
        departmentDetailPath(tenantSlug, department.slug, userName, layer)
      }
      description="Open a department to browse its modules."
    />
  );
}
