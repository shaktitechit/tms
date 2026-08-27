'use client';

import { useEffect, useRef } from 'react';
import { VideoSeenStatus } from '@video/shared';
import { useAuth } from '@/lib/auth';
import type { VideoDto } from '@/lib/types';
import { useMarkVideoSeenMutation } from '@/store/api';

export function useReportVideoSeen(video?: Pick<VideoDto, 'id' | 'seenStatus'> | null) {
  const { user } = useAuth();
  const [markVideoSeen] = useMarkVideoSeenMutation();
  const reported = useRef(video?.seenStatus === VideoSeenStatus.COMPLETED);

  useEffect(() => {
    reported.current = video?.seenStatus === VideoSeenStatus.COMPLETED;
  }, [video?.id, video?.seenStatus]);

  return () => {
    if (!user || !video || reported.current) {
      return;
    }
    reported.current = true;
    void markVideoSeen({ id: video.id, role: user.role });
  };
}
