'use client';

import { useParams } from 'next/navigation';
import { VideoManagePanel } from '@/components/VideoManagePanel';

export default function TenantVideoDetailPage() {
  const params = useParams<{ tenantSlug: string; videoSlug: string }>();
  return <VideoManagePanel videoSlug={params.videoSlug} />;
}
