'use client';

import { useParams } from 'next/navigation';
import { MemberProgressView } from '@/components/MemberProgressView';
import { useMemberWorkspace } from '@/lib/member-workspace';

export default function TutorLearnerDetailPage() {
  const { tenantSlug } = useMemberWorkspace();
  const params = useParams<{ learnerSlug: string }>();
  return (
    <MemberProgressView tenantSlug={tenantSlug} userSlug={params.learnerSlug} />
  );
}
