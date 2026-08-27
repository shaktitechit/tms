'use client';

import { useParams } from 'next/navigation';
import { LessonDetailPanel } from '@/components/LessonDetailPanel';

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

  return <LessonDetailPanel lessonSlug={params.lesson_slug} />;
}
