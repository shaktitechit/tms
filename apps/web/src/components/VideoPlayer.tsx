'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { formatDuration } from '@/lib/format';

interface VideoPlayerProps {
  src: string;
  poster?: string | null;
  onSeen?: () => void;
}

interface LevelOption {
  index: number;
  label: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function ControlIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-100 transition hover:bg-white/15"
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}

function VolumeOnIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 00-2.47-4.03v8.05A4.5 4.5 0 0016.5 12zM14 3.23v2.06a7 7 0 010 13.54v2.07a9 9 0 000-17.66z" />
    </svg>
  );
}

function VolumeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M3.63 3.63a1 1 0 000 1.41L7.05 8.5 3 8.5v7h4l5 5v-6.59l4.18 4.18a1 1 0 001.41-1.41L4.05 3.63a1 1 0 00-1.42 0zM16.5 12a4.5 4.5 0 00-2.47-4.03v2.22l2.47 2.47V12zm-1.73-7.77v1.94a7 7 0 010 11.54v1.94a9 9 0 000-17.42z" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );
}

export function VideoPlayer({ src, poster, onSeen }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const onSeenRef = useRef(onSeen);
  const reportedSeenRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [playbackRate, setPlaybackRate] = useState(1);
  onSeenRef.current = onSeen;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    reportedSeenRef.current = false;

    setLoading(true);
    setError(null);
    setLevels([]);
    setCurrentLevel(-1);

    const nativeHls = video.canPlayType('application/vnd.apple.mpegurl');
    if (nativeHls) {
      video.src = src;
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: true,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setLevels(
          data.levels.map((level, index) => ({
            index,
            label: level.height ? `${level.height}p` : `Level ${index + 1}`,
          })),
        );
        setLoading(false);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError('Unable to play this video');
          setLoading(false);
        }
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    setError('HLS playback is not supported in this browser');
    setLoading(false);
    return undefined;
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const onTime = () => {
      setProgress(video.currentTime);
      reportIfFinished(video);
    };
    const onMeta = () => {
      setDuration(video.duration || 0);
      setLoading(false);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onEnded = () => {
      setPlaying(false);
      reportIfFinished(video);
    };
    const onErr = () => {
      setError('Playback error');
      setLoading(false);
    };

    function reportIfFinished(el: HTMLVideoElement) {
      if (reportedSeenRef.current) {
        return;
      }
      const length = el.duration;
      if (!Number.isFinite(length) || length <= 0) {
        return;
      }
      const reachedEnd = el.ended || el.currentTime >= length - 0.5;
      if (!reachedEnd) {
        return;
      }
      reportedSeenRef.current = true;
      onSeenRef.current?.();
    }

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onErr);

    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onErr);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  function onSeek(value: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.currentTime = value;
    setProgress(value);
  }

  function onVolume(value: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (muted || volume === 0) {
      const restored = volume > 0 ? volume : 1;
      video.volume = restored;
      video.muted = false;
      setVolume(restored);
      setMuted(false);
    } else {
      video.muted = true;
      setMuted(true);
    }
  }

  async function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  }

  function changeQuality(level: number) {
    setCurrentLevel(level);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
    }
  }

  function changeSpeed(rate: number) {
    setPlaybackRate(rate);
  }

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl bg-black shadow-glow sm:rounded-2xl">
      <video
        ref={videoRef}
        className="video-surface aspect-video w-full bg-black"
        poster={poster ?? undefined}
        playsInline
        onClick={togglePlay}
      />
      {loading && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-zinc-200">
          Loading stream…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2 pb-2 pt-10 sm:px-3 sm:pb-3">
        <div className="mb-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={progress}
            onChange={(event) => onSeek(Number(event.target.value))}
            style={{
              background: `linear-gradient(to right, rgb(37 99 235) ${progressPercent}%, rgb(255 255 255 / 0.2) ${progressPercent}%)`,
            }}
            className="h-1 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
            aria-label="Seek"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <ControlIconButton label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </ControlIconButton>

          <ControlIconButton label={muted || volume === 0 ? 'Unmute' : 'Mute'} onClick={toggleMute}>
            {muted || volume === 0 ? <VolumeOffIcon /> : <VolumeOnIcon />}
          </ControlIconButton>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(event) => onVolume(Number(event.target.value))}
            className="hidden w-20 sm:block"
            aria-label="Volume"
          />

          <span className="min-w-[4.5rem] tabular-nums text-xs text-zinc-300 sm:text-sm">
            {formatDuration(progress)} / {formatDuration(duration)}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-300">
              <span className="hidden sm:inline">Speed</span>
              <select
                value={playbackRate}
                onChange={(event) => changeSpeed(Number(event.target.value))}
                className="rounded-lg border border-white/20 bg-black/70 px-2 py-1.5 text-xs text-white"
                aria-label="Playback speed"
              >
                {SPEEDS.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed === 1 ? '1×' : `${speed}×`}
                  </option>
                ))}
              </select>
            </label>

            {levels.length > 0 ? (
              <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                <span className="hidden sm:inline">Quality</span>
                <select
                  value={currentLevel}
                  onChange={(event) => changeQuality(Number(event.target.value))}
                  className="rounded-lg border border-white/20 bg-black/70 px-2 py-1.5 text-xs text-white"
                  aria-label="Video quality"
                >
                  <option value={-1}>Auto</option>
                  {levels.map((level) => (
                    <option key={level.index} value={level.index}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <ControlIconButton label="Fullscreen" onClick={() => void toggleFullscreen()}>
              <FullscreenIcon />
            </ControlIconButton>
          </div>
        </div>
      </div>
    </div>
  );
}
