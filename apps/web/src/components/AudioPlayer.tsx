'use client';

import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export function AudioPlayer({
  src,
  onSeen,
}: {
  src: string;
  onSeen?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const reported = useRef(false);

  useEffect(() => {
    reported.current = false;
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) {
      return;
    }

    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        xhrSetup: (xhr) => {
          xhr.withCredentials = true;
        },
      });
      hls.loadSource(src);
      hls.attachMedia(audio);
      return () => {
        hls.destroy();
      };
    }

    audio.src = src;
    return undefined;
  }, [src]);

  function maybeReportSeen() {
    if (!onSeen || reported.current) {
      return;
    }
    reported.current = true;
    onSeen();
  }

  return (
    <audio
      ref={audioRef}
      controls
      preload="metadata"
      className="w-full"
      onEnded={maybeReportSeen}
      onPause={() => {
        const el = audioRef.current;
        if (!el || !el.duration) {
          return;
        }
        if (el.currentTime / el.duration >= 0.9) {
          maybeReportSeen();
        }
      }}
    >
      Your browser does not support audio playback.
    </audio>
  );
}
