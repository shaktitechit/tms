'use client';

import { useParams } from 'next/navigation';
import { MemberAccessGate } from '@/components/portals/member/MemberAccess';
import { MemberProgressView } from '@/components/MemberProgressView';

export default function TutorLearnerDetailPage() {
  return (
    <MemberAccessGate
      access="tutor"
      fallback={<p className="text-slate-500">This page is only accessible to tutors.</p>}
    >
      <LearnerDetailContent />
    </MemberAccessGate>
  );
}

function LearnerDetailContent() {
  const params = useParams<{ tenantSlug: string; learnerSlug: string }>();
  return (
    <MemberProgressView
      tenantSlug={params.tenantSlug}
      userSlug={params.learnerSlug}
    />
  );
}
