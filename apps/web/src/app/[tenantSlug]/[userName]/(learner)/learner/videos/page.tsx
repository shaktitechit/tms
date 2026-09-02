'use client';

import { VideoLibrary } from '@/components/VideoLibrary';
import { useMemberWorkspace } from '@/lib/member-workspace';

export default function MemberVideosPage() {
  const { base } = useMemberWorkspace();
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
