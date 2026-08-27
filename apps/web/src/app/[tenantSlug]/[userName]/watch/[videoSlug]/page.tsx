'use client';

import { useParams } from 'next/navigation';
import { WatchVideoView } from '@/components/WatchVideoView';

export default function MemberWatchPage() {
  const params = useParams<{ tenantSlug: string; userName: string; videoSlug: string }>();
  const base = `/${params.tenantSlug}/${params.userName}`;
  return (
    <WatchVideoView
      videoSlug={params.videoSlug}
      manageHref={`${base}/videos/${params.videoSlug}`}
    />
  );
}
