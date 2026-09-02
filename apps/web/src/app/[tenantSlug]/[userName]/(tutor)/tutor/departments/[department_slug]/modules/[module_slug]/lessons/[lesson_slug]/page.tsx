'use client';

import { useParams } from 'next/navigation';
import { LessonDetailPanel } from '@/components/LessonDetailPanel';
import { useMemberWorkspace } from '@/lib/member-workspace';
import { lessonDetailPath, moduleDetailPath } from '@/lib/roles';

export default function MemberLessonDetailPage() {
  const { tenantSlug, userName, layer } = useMemberWorkspace();
  const params = useParams<{
    department_slug: string;
    module_slug: string;
    lesson_slug: string;
  }>();

  return (
    <LessonDetailPanel
      lessonSlug={params.lesson_slug}
      moduleSlug={params.module_slug}
      moduleHref={moduleDetailPath(
        tenantSlug,
        params.department_slug,
        params.module_slug,
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
