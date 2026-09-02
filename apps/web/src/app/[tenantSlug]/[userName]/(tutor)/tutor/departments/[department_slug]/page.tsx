'use client';

import { useParams } from 'next/navigation';
import { DepartmentDetailPanel } from '@/components/DepartmentDetailPanel';
import { useMemberWorkspace } from '@/lib/member-workspace';
import { departmentsPath, moduleDetailPath } from '@/lib/roles';

export default function MemberDepartmentDetailPage() {
  const { tenantSlug, userName, layer } = useMemberWorkspace();
  const params = useParams<{ department_slug: string }>();

  return (
    <DepartmentDetailPanel
      departmentSlug={params.department_slug}
      listHref={departmentsPath(tenantSlug, userName, layer)}
      moduleDetailHref={(moduleSlug) =>
        moduleDetailPath(tenantSlug, params.department_slug, moduleSlug, userName, layer)
      }
    />
  );
}
