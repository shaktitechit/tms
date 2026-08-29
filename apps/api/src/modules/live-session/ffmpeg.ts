import { spawn, type ChildProcess } from 'child_process';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import type { Logger } from '@video/shared/server';

const activeProcesses = new Map<string, ChildProcess>();
const sessionSegments = new Map<string, string[]>();

function recordingDir() {
  return process.env.LIVE_RECORDING_DIR || '/tmp/recordings';
}

function existingSegments(liveSessionId: string) {
  return (sessionSegments.get(liveSessionId) || []).filter((file) => existsSync(file));
}

function spawnFfmpeg(args: string[]) {
  return spawn('ffmpeg', args);
}

function waitForClose(child: ChildProcess, timeoutMs: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // already gone
      }
      resolve();
    }, timeoutMs);

    child.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function stopProcess(liveSessionId: string, logger: Logger) {
  const ffmpeg = activeProcesses.get(liveSessionId);
  if (!ffmpeg) return Promise.resolve();

  logger.info({ liveSessionId }, 'Stopping FFmpeg recording process');

  return new Promise<void>((resolve) => {
    void waitForClose(ffmpeg, 8000).then(() => {
      activeProcesses.delete(liveSessionId);
      resolve();
    });

    try {
      ffmpeg.stdin?.end();
    } catch (err) {
      logger.error(err, `Error ending FFmpeg stdin for session ${liveSessionId}`);
      try {
        ffmpeg.kill('SIGKILL');
      } catch {
        // already gone
      }
      activeProcesses.delete(liveSessionId);
      resolve();
    }
  });
}

export const ffmpegBridge = {
  isActive(liveSessionId: string) {
    return activeProcesses.has(liveSessionId);
  },

  startTranscoding(liveSessionId: string, logger: Logger) {
    if (activeProcesses.has(liveSessionId)) {
      logger.info({ liveSessionId }, 'FFmpeg recording process already active for session');
      return;
    }

    mkdirSync(recordingDir(), { recursive: true });
    const segments = sessionSegments.get(liveSessionId) || [];
    const outFile = path.join(recordingDir(), `${liveSessionId}.part${segments.length}.mp4`);
    segments.push(outFile);
    sessionSegments.set(liveSessionId, segments);

    if (existsSync(outFile)) {
      try {
        unlinkSync(outFile);
      } catch {
        // continue
      }
    }

    logger.info({ liveSessionId, outFile }, 'Spawning FFmpeg process to record session');

    const args = [
      '-fflags',
      '+discardcorrupt',
      '-thread_queue_size',
      '1024',
      '-analyzeduration',
      '2000000',
      '-probesize',
      '2000000',
      '-f',
      'webm',
      '-i',
      'pipe:0',
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '24',
      '-g',
      '48',
      '-keyint_min',
      '24',
      '-sc_threshold',
      '0',
      '-fps_mode',
      'cfr',
      '-c:a',
      'aac',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-max_interleave_delta',
      '0',
      '-f',
      'mp4',
      '-movflags',
      '+frag_keyframe+empty_moov+default_base_moof',
      outFile,
    ];

    try {
      const ffmpeg = spawnFfmpeg(args);

      ffmpeg.stderr?.on('data', (data) => {
        const str = data.toString();
        if (str.toLowerCase().includes('error') || str.toLowerCase().includes('warning')) {
          logger.warn(`[FFmpeg-${liveSessionId}]: ${str.trim()}`);
        }
      });

      ffmpeg.on('close', (code) => {
        logger.info({ liveSessionId, code }, 'FFmpeg recording process closed');
        activeProcesses.delete(liveSessionId);
      });

      ffmpeg.on('error', (err) => {
        logger.error(err, `[FFmpeg-${liveSessionId}] Spawning error`);
        activeProcesses.delete(liveSessionId);
      });

      activeProcesses.set(liveSessionId, ffmpeg);
    } catch (err) {
      logger.error(err, `Failed to spawn FFmpeg process for session ${liveSessionId}`);
    }
  },

  async rotateTranscoding(liveSessionId: string, logger: Logger) {
    await stopProcess(liveSessionId, logger);
    this.startTranscoding(liveSessionId, logger);
  },

  writeChunk(liveSessionId: string, chunk: Buffer, logger: Logger) {
    const ffmpeg = activeProcesses.get(liveSessionId);
    if (!ffmpeg) {
      // Do not spawn mid-stream — a new WebM header would freeze video and desync audio.
      logger.warn({ liveSessionId }, 'Dropping chunk; no active FFmpeg recording process');
      return;
    }

    const payload = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer);
    if (ffmpeg.stdin?.writable) {
      ffmpeg.stdin.write(payload, (err) => {
        if (err) {
          logger.error(err, `Error writing chunk to FFmpeg stdin for session ${liveSessionId}`);
        }
      });
    } else {
      logger.warn({ liveSessionId }, 'FFmpeg process stdin is not writable');
    }
  },

  async stopTranscoding(liveSessionId: string, logger: Logger): Promise<string[]> {
    await stopProcess(liveSessionId, logger);
    return existingSegments(liveSessionId);
  },

  cleanupSessionFiles(liveSessionId: string) {
    for (const file of existingSegments(liveSessionId)) {
      try {
        unlinkSync(file);
      } catch {
        // ignore cleanup errors
      }
    }
    sessionSegments.delete(liveSessionId);
  },
};
