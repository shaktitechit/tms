'use client';

import { useParams } from 'next/navigation';
import { VideoLibrary } from '@/components/VideoLibrary';

export default function MemberVideosPage() {
  const params = useParams<{ tenantSlug: string; userName: string }>();
  const base = `/${params.tenantSlug}/${params.userName}`;
  return (
    <VideoLibrary
      role="user"
      tab="videos"
      videosBase={`${base}/videos`}
      audiosBase={`${base}/audios`}
      description="Videos belonging to your tenant."
    />
  );
}
