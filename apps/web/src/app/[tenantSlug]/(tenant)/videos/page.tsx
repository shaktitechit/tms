'use client';

import { useParams } from 'next/navigation';
import { VideoLibrary } from '@/components/VideoLibrary';

export default function TenantVideosPage() {
  const params = useParams<{ tenantSlug: string }>();
  const base = `/${params.tenantSlug}`;
  return (
    <VideoLibrary
      role="tenant"
      tab="videos"
      videosBase={`${base}/videos`}
      audiosBase={`${base}/audios`}
      description="Videos belonging to your tenant."
    />
  );
}
