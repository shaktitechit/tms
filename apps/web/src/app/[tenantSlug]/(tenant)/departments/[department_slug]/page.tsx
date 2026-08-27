'use client';

import { useParams } from 'next/navigation';
import { DepartmentDetailPanel } from '@/components/DepartmentDetailPanel';
import { moduleDetailPath } from '@/lib/roles';

export default function TenantDepartmentDetailPage() {
  const params = useParams<{ tenantSlug: string; department_slug: string }>();

  return (
    <DepartmentDetailPanel
      departmentSlug={params.department_slug}
      moduleDetailHref={(moduleSlug) =>
        moduleDetailPath(params.tenantSlug, params.department_slug, moduleSlug)
      }
    />
  );
}
