'use client';

import { useParams } from 'next/navigation';
import { WatchVideoView } from '@/components/WatchVideoView';

export default function TenantWatchPage() {
  const params = useParams<{ tenantSlug: string; videoSlug: string }>();
  const base = `/${params.tenantSlug}`;
  return (
    <WatchVideoView
      videoSlug={params.videoSlug}
      manageHref={`${base}/videos/${params.videoSlug}`}
    />
  );
}
