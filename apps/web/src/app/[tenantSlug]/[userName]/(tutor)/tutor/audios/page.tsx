'use client';

import { VideoLibrary } from '@/components/VideoLibrary';
import { useMemberWorkspace } from '@/lib/member-workspace';

export default function MemberAudiosPage() {
  const { base } = useMemberWorkspace();
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
