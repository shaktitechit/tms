import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  UnrecoverableProcessingError,
  evenDimension,
  type QualityLadderEntry,
} from '@video/shared';
import type { Logger } from '@video/shared/server';
import { parseFfmpegProgress, runCommand } from './command.js';
import type { VideoProbe } from './probe.js';

export interface VariantResult {
  quality: QualityLadderEntry;
  outputWidth: number;
  outputHeight: number;
  playlistRelativePath: string;
}

export function buildMasterPlaylist(variants: VariantResult[]): string {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const variant of variants) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${variant.quality.bandwidth},RESOLUTION=${variant.outputWidth}x${variant.outputHeight},NAME="${variant.quality.name}"`,
    );
    lines.push(variant.playlistRelativePath);
  }
  return `${lines.join('\n')}\n`;
}

export async function transcodeVariant(input: {
  sourcePath: string;
  workDir: string;
  variant: QualityLadderEntry;
  probe: VideoProbe;
  segmentDuration: number;
  preset: string;
  crf: number;
  logger: Logger;
  onProgress: (seconds: number) => void;
}): Promise<VariantResult> {
  const outputHeight = evenDimension(Math.min(input.variant.height, input.probe.height));
  const outputWidth = evenDimension(
    Math.round((input.probe.width / input.probe.height) * outputHeight),
  );
  const outDir = path.join(input.workDir, 'hls', input.variant.name);
  await mkdir(outDir, { recursive: true });

  const gop = Math.max(2, Math.round(input.probe.fps * 2));
  const args = [
    '-y',
    '-i',
    input.sourcePath,
    '-vf',
    `scale=${outputWidth}:${outputHeight}`,
    '-c:v',
    'libx264',
    '-preset',
    input.preset,
    '-crf',
    String(input.crf),
    '-profile:v',
    'main',
    '-level',
    '4.0',
    '-pix_fmt',
    'yuv420p',
    '-maxrate',
    input.variant.maxrate,
    '-bufsize',
    input.variant.bufsize,
    '-g',
    String(gop),
    '-keyint_min',
    String(Math.round(input.probe.fps) || 30),
    '-sc_threshold',
    '0',
  ];

  if (input.probe.hasAudio) {
    args.push('-c:a', 'aac', '-b:a', input.variant.audioBitrate, '-ac', '2', '-ar', '48000');
  } else {
    args.push('-an');
  }

  args.push(
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
  );

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
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : undefined;
    throw new UnrecoverableProcessingError(
      `FFmpeg failed while generating ${input.variant.name}`,
      stderr,
    );
  }

  return {
    quality: input.variant,
    outputWidth,
    outputHeight,
    playlistRelativePath: `${input.variant.name}/index.m3u8`,
  };
}

export async function writeMasterPlaylist(workDir: string, variants: VariantResult[]): Promise<string> {
  const playlist = buildMasterPlaylist(variants);
  const filePath = path.join(workDir, 'hls', 'master.m3u8');
  await writeFile(filePath, playlist, 'utf8');
  return filePath;
}
