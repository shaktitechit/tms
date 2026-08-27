'use client';

import { useParams } from 'next/navigation';
import { VideoManagePanel } from '@/components/VideoManagePanel';

export default function MemberVideoDetailPage() {
  const params = useParams<{ tenantSlug: string; userName: string; videoSlug: string }>();
  return <VideoManagePanel videoSlug={params.videoSlug} />;
}
