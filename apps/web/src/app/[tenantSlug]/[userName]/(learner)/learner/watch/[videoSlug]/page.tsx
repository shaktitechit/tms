'use client';

import { useParams } from 'next/navigation';
import { WatchVideoView } from '@/components/WatchVideoView';
import { useMemberWorkspace } from '@/lib/member-workspace';

export default function MemberWatchPage() {
  const { base } = useMemberWorkspace();
  const params = useParams<{ videoSlug: string }>();
  return (
    <WatchVideoView
      videoSlug={params.videoSlug}
      manageHref={`${base}/videos/${params.videoSlug}`}
    />
  );
}
