'use client';

import { useParams } from 'next/navigation';
import { LessonDetailPanel } from '@/components/LessonDetailPanel';

export default function MemberLessonDetailPage() {
  const params = useParams<{
    tenantSlug: string;
    userName: string;
    department_slug: string;
    module_slug: string;
    lesson_slug: string;
  }>();

  return <LessonDetailPanel lessonSlug={params.lesson_slug} />;
}
