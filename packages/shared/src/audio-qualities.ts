import { AudioQuality, type AudioQualityLadderEntry } from './types.js';

export const AUDIO_QUALITY_LADDER: readonly AudioQualityLadderEntry[] = [
  {
    name: AudioQuality.K96,
    audioBitrate: '96k',
    bandwidth: 96_000,
  },
  {
    name: AudioQuality.K128,
    audioBitrate: '128k',
    bandwidth: 128_000,
  },
  {
    name: AudioQuality.K192,
    audioBitrate: '192k',
    bandwidth: 192_000,
  },
] as const;

/**
 * Returns AAC ladder rungs that would not upscale the source bitrate.
 * Always returns at least the lowest rung.
 */
export function audioQualitiesForSource(sourceBitrate: number | null): AudioQualityLadderEntry[] {
  if (!sourceBitrate || sourceBitrate <= 0) {
    return [...AUDIO_QUALITY_LADDER];
  }

  const matching = AUDIO_QUALITY_LADDER.filter((entry) => sourceBitrate >= entry.bandwidth * 0.85);
  if (matching.length > 0) {
    return [...matching];
  }

  const base = AUDIO_QUALITY_LADDER[0];
  if (!base) {
    throw new Error('Audio quality ladder is empty');
  }
  return [base];
}
