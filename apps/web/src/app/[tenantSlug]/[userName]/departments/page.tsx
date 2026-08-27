'use client';

import { useParams } from 'next/navigation';
import { DepartmentsListView } from '@/components/DepartmentsListView';
import { departmentDetailPath } from '@/lib/roles';

export default function MemberDepartmentsPage() {
  const params = useParams<{ tenantSlug: string; userName: string }>();

  return (
    <DepartmentsListView
      detailHref={(department) =>
        departmentDetailPath(params.tenantSlug, department.slug, params.userName)
      }
      description="Open a department to browse its modules."
    />
  );
}
