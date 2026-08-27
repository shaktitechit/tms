import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UnrecoverableProcessingError, type AudioQualityLadderEntry } from '@video/shared';
import type { Logger } from '@video/shared/server';
import { parseFfmpegProgress, runCommand } from './command.js';
import type { AudioProbe } from './audio-probe.js';

export interface AudioVariantResult {
  quality: AudioQualityLadderEntry;
  playlistRelativePath: string;
}

export function buildAudioMasterPlaylist(variants: AudioVariantResult[]): string {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const variant of variants) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${variant.quality.bandwidth},CODECS="mp4a.40.2",NAME="${variant.quality.name}"`,
    );
    lines.push(variant.playlistRelativePath);
  }
  return `${lines.join('\n')}\n`;
}

export async function transcodeAudioVariant(input: {
  sourcePath: string;
  workDir: string;
  variant: AudioQualityLadderEntry;
  probe: AudioProbe;
  segmentDuration: number;
  logger: Logger;
  onProgress: (seconds: number) => void;
}): Promise<AudioVariantResult> {
  const outDir = path.join(input.workDir, 'hls', input.variant.name);
  await mkdir(outDir, { recursive: true });

  const args = [
    '-y',
    '-i',
    input.sourcePath,
    '-vn',
    '-c:a',
    'aac',
    '-b:a',
    input.variant.audioBitrate,
    '-ac',
    '2',
    '-ar',
    '48000',
    '-hls_time',
    String(input.segmentDuration),
    '-hls_playlist_type',
    'vod',
    '-hls_flags',
    'independent_segments',
    '-hls_segment_filename',
    path.join(outDir, 'segment%03d.ts'),
    '-progress',
    'pipe:1',
    '-nostats',
    path.join(outDir, 'index.m3u8'),
  ];

  try {
    await runCommand(
      'ffmpeg',
      {
        args,
        onStdoutLine: (line) => {
          const seconds = parseFfmpegProgress(line);
          if (seconds !== null) {
            input.onProgress(seconds);
          }
        },
      },
      input.logger,
    );
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : undefined;
    throw new UnrecoverableProcessingError(
      `FFmpeg failed while generating ${input.variant.name}`,
      stderr,
    );
  }

  return {
    quality: input.variant,
    playlistRelativePath: `${input.variant.name}/index.m3u8`,
  };
}

export async function writeAudioMasterPlaylist(
  workDir: string,
  variants: AudioVariantResult[],
): Promise<string> {
  const playlist = buildAudioMasterPlaylist(variants);
  const filePath = path.join(workDir, 'hls', 'master.m3u8');
  await writeFile(filePath, playlist, 'utf8');
  return filePath;
}
