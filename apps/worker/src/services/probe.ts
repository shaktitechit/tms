import { UnrecoverableProcessingError } from '@video/shared';
import type { Logger } from '@video/shared/server';
import { runCommand } from './command.js';

export interface VideoProbe {
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number | null;
  fps: number;
  hasAudio: boolean;
}

interface ProbeJson {
  format?: {
    duration?: string;
    bit_rate?: string;
  };
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    bit_rate?: string;
    avg_frame_rate?: string;
    r_frame_rate?: string;
  }>;
}

function parseFrameRate(value?: string): number {
  if (!value || value === '0/0') {
    return 30;
  }
  const [num, den] = value.split('/').map(Number);
  if (!num || !den) {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : 30;
  }
  return num / den;
}

export async function probeVideo(inputPath: string, logger: Logger): Promise<VideoProbe> {
  try {
    const { stdout, stderr } = await runCommand(
      'ffprobe',
      {
        args: ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', inputPath],
      },
      logger,
    );

    const parsed = JSON.parse(stdout) as ProbeJson;
    const videoStream = parsed.streams?.find((stream) => stream.codec_type === 'video');
    if (!videoStream || !videoStream.width || !videoStream.height) {
      throw new UnrecoverableProcessingError('Source file has no video stream', stderr);
    }

    const duration = Number(parsed.format?.duration ?? 0);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new UnrecoverableProcessingError('Unable to determine video duration', stderr);
    }

    const bitrate = Number(videoStream.bit_rate ?? parsed.format?.bit_rate);
    const fps = parseFrameRate(videoStream.avg_frame_rate || videoStream.r_frame_rate);
    const hasAudio = Boolean(parsed.streams?.some((stream) => stream.codec_type === 'audio'));

    return {
      duration,
      width: videoStream.width,
      height: videoStream.height,
      codec: videoStream.codec_name ?? 'unknown',
      bitrate: Number.isFinite(bitrate) ? bitrate : null,
      fps,
      hasAudio,
    };
  } catch (error) {
    if (error instanceof UnrecoverableProcessingError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'ffprobe failed';
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : undefined;
    throw new UnrecoverableProcessingError(message, stderr);
  }
}
