'use client';

import { useParams } from 'next/navigation';
import { VideoLibrary } from '@/components/VideoLibrary';

export default function TenantAudiosPage() {
  const params = useParams<{ tenantSlug: string }>();
  const base = `/${params.tenantSlug}`;
  return (
    <VideoLibrary
      role="tenant"
      tab="audios"
      videosBase={`${base}/videos`}
      audiosBase={`${base}/audios`}
      description="Audios belonging to your tenant."
    />
  );
}
