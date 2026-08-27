'use client';

import { useParams } from 'next/navigation';
import { VideoLibrary } from '@/components/VideoLibrary';

export default function MemberAudiosPage() {
  const params = useParams<{ tenantSlug: string; userName: string }>();
  const base = `/${params.tenantSlug}/${params.userName}`;
  return (
    <VideoLibrary
      role="user"
      tab="audios"
      videosBase={`${base}/videos`}
      audiosBase={`${base}/audios`}
      description="Audios belonging to your tenant."
    />
  );
}
