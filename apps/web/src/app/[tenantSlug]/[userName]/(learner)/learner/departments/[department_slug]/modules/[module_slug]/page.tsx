'use client';

import { useParams } from 'next/navigation';
import { ModuleLessonsPanel } from '@/components/ModuleLessonsPanel';
import { useMemberWorkspace } from '@/lib/member-workspace';
import { departmentDetailPath, lessonDetailPath } from '@/lib/roles';

export default function MemberDepartmentModuleDetailPage() {
  const { tenantSlug, userName, layer } = useMemberWorkspace();
  const params = useParams<{ department_slug: string; module_slug: string }>();

  return (
    <ModuleLessonsPanel
      moduleSlug={params.module_slug}
      departmentHref={departmentDetailPath(
        tenantSlug,
        params.department_slug,
        userName,
        layer,
      )}
      lessonDetailHref={(lessonSlug) =>
        lessonDetailPath(
          tenantSlug,
          params.department_slug,
          params.module_slug,
          lessonSlug,
          userName,
          layer,
        )
      }
    />
  );
}
