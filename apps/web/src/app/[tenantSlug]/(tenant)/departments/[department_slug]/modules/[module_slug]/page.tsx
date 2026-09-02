'use client';

import { useParams } from 'next/navigation';
import { ModuleLessonsPanel } from '@/components/ModuleLessonsPanel';
import { departmentDetailPath, lessonDetailPath } from '@/lib/roles';

export default function TenantDepartmentModuleDetailPage() {
  const params = useParams<{
    tenantSlug: string;
    department_slug: string;
    module_slug: string;
  }>();

  return (
    <ModuleLessonsPanel
      moduleSlug={params.module_slug}
      departmentHref={departmentDetailPath(params.tenantSlug, params.department_slug)}
      lessonDetailHref={(lessonSlug) =>
        lessonDetailPath(
          params.tenantSlug,
          params.department_slug,
          params.module_slug,
          lessonSlug,
        )
      }
    />
  );
}
