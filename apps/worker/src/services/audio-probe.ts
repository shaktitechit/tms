import { UnrecoverableProcessingError } from '@video/shared';
import type { Logger } from '@video/shared/server';
import { runCommand } from './command.js';

export interface AudioProbe {
  duration: number;
  codec: string;
  bitrate: number | null;
  sampleRate: number | null;
  channels: number | null;
}

interface ProbeJson {
  format?: {
    duration?: string;
    bit_rate?: string;
  };
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    bit_rate?: string;
    sample_rate?: string;
    channels?: number;
  }>;
}

export async function probeAudio(inputPath: string, logger: Logger): Promise<AudioProbe> {
  try {
    const { stdout, stderr } = await runCommand(
      'ffprobe',
      {
        args: ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', inputPath],
      },
      logger,
    );

    const parsed = JSON.parse(stdout) as ProbeJson;
    const audioStream = parsed.streams?.find((stream) => stream.codec_type === 'audio');
    if (!audioStream) {
      throw new UnrecoverableProcessingError('Source file has no audio stream', stderr);
    }

    const duration = Number(parsed.format?.duration ?? 0);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new UnrecoverableProcessingError('Unable to determine audio duration', stderr);
    }

    const bitrate = Number(audioStream.bit_rate ?? parsed.format?.bit_rate);
    const sampleRate = Number(audioStream.sample_rate);

    return {
      duration,
      codec: audioStream.codec_name ?? 'unknown',
      bitrate: Number.isFinite(bitrate) ? bitrate : null,
      sampleRate: Number.isFinite(sampleRate) ? sampleRate : null,
      channels: audioStream.channels ?? null,
    };
  } catch (error) {
    if (error instanceof UnrecoverableProcessingError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'ffprobe failed';
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : undefined;
    throw new UnrecoverableProcessingError(message, stderr);
  }
}
