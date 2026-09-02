'use client';

import { useEffect, useRef } from 'react';
import { parseYoutubeVideoId } from '@video/shared';

type YoutubePlayer = {
  destroy: () => void;
};

type YoutubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, number | string>;
      events?: { onStateChange?: (event: { data: number }) => void };
    },
  ) => YoutubePlayer;
  PlayerState: { ENDED: number };
};

declare global {
  interface Window {
    YT?: YoutubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YoutubeNamespace> | null = null;

function loadYoutubeApi(): Promise<YoutubeNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube API is browser-only'));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiPromise) {
    return apiPromise;
  }
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) {
        resolve(window.YT);
      }
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(script);
    }
    if (window.YT?.Player) {
      resolve(window.YT);
    }
  });
  return apiPromise;
}

export function YouTubeEmbed({ src, onSeen }: { src: string; onSeen?: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  const videoId = parseYoutubeVideoId(src);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !videoId) {
      return;
    }

    let player: YoutubePlayer | null = null;
    let cancelled = false;

    void loadYoutubeApi().then((YT) => {
      if (cancelled || !hostRef.current) {
        return;
      }
      player = new YT.Player(hostRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
        },
        events: {
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              onSeenRef.current?.();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, [videoId]);

  if (!videoId) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-black text-sm text-rose-200 sm:rounded-2xl">
        Invalid YouTube link
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black shadow-glow sm:rounded-2xl">
      <div className="aspect-video w-full">
        <div key={videoId} ref={hostRef} className="h-full w-full" />
      </div>
    </div>
  );
}
