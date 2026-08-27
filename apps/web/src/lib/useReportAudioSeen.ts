'use client';

import { useEffect, useRef } from 'react';
import { ContentSeenStatus } from '@video/shared';
import { useAuth } from '@/lib/auth';
import type { AudioDto } from '@/lib/types';
import { useMarkAudioSeenMutation } from '@/store/api';

export function useReportAudioSeen(audio?: Pick<AudioDto, 'id' | 'seenStatus'> | null) {
  const { user } = useAuth();
  const [markAudioSeen] = useMarkAudioSeenMutation();
  const reported = useRef(audio?.seenStatus === ContentSeenStatus.COMPLETED);

  useEffect(() => {
    reported.current = audio?.seenStatus === ContentSeenStatus.COMPLETED;
  }, [audio?.id, audio?.seenStatus]);

  return () => {
    if (!user || !audio || reported.current) {
      return;
    }
    reported.current = true;
    void markAudioSeen(audio.id);
  };
}
