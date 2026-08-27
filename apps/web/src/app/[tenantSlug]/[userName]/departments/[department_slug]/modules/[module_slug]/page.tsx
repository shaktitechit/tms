'use client';

import { useParams } from 'next/navigation';
import { ModuleLessonsPanel } from '@/components/ModuleLessonsPanel';
import { lessonDetailPath } from '@/lib/roles';

export default function MemberDepartmentModuleDetailPage() {
  const params = useParams<{
    tenantSlug: string;
    userName: string;
    department_slug: string;
    module_slug: string;
  }>();

  return (
    <ModuleLessonsPanel
      moduleSlug={params.module_slug}
      lessonDetailHref={(lessonSlug) =>
        lessonDetailPath(
          params.tenantSlug,
          params.department_slug,
          params.module_slug,
          lessonSlug,
          params.userName,
        )
      }
    />
  );
}
