import { VideoQuality, type QualityLadderEntry } from './types.js';

export const QUALITY_LADDER: readonly QualityLadderEntry[] = [
  {
    name: VideoQuality.P360,
    height: 360,
    width: 640,
    maxrate: '800k',
    bufsize: '1600k',
    audioBitrate: '96k',
    bandwidth: 800_000,
  },
  {
    name: VideoQuality.P480,
    height: 480,
    width: 854,
    maxrate: '1400k',
    bufsize: '2800k',
    audioBitrate: '128k',
    bandwidth: 1_400_000,
  },
  {
    name: VideoQuality.P720,
    height: 720,
    width: 1280,
    maxrate: '2800k',
    bufsize: '5600k',
    audioBitrate: '128k',
    bandwidth: 2_800_000,
  },
  {
    name: VideoQuality.P1080,
    height: 1080,
    width: 1920,
    maxrate: '5000k',
    bufsize: '10000k',
    audioBitrate: '192k',
    bandwidth: 5_000_000,
  },
] as const;

/**
 * Returns ladder rungs that would not upscale the source.
 * Always returns at least one rendition: the highest rung that fits, or a
 * source-capped 360p-labelled variant when the video is smaller than 360p.
 */
export function qualitiesForSource(width: number, height: number): QualityLadderEntry[] {
  const matching = QUALITY_LADDER.filter((entry) => height >= entry.height);
  if (matching.length > 0) {
    return [...matching];
  }

  const base = QUALITY_LADDER[0];
  if (!base) {
    throw new Error('Quality ladder is empty');
  }
  return [
    {
      ...base,
      height,
      width: evenDimension(width),
    },
  ];
}

export function evenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}
