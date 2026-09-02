'use client';

import { useParams } from 'next/navigation';
import { LessonDetailPanel } from '@/components/LessonDetailPanel';
import { lessonDetailPath, moduleDetailPath } from '@/lib/roles';

/**
 * Tenant lesson detail: lists lesson content and supports add-content.
 * Audio items poll processing status and play HLS when ready.
 */
export default function TenantLessonDetailPage() {
  const params = useParams<{
    tenantSlug: string;
    department_slug: string;
    module_slug: string;
    lesson_slug: string;
  }>();

  return (
    <LessonDetailPanel
      lessonSlug={params.lesson_slug}
      moduleSlug={params.module_slug}
      moduleHref={moduleDetailPath(
        params.tenantSlug,
        params.department_slug,
        params.module_slug,
      )}
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
