import { createWriteStream, existsSync, mkdirSync, unlinkSync, type WriteStream } from 'fs';
import path from 'path';
import type { Logger } from '@video/shared/server';

interface SessionWriter {
  stream: WriteStream;
  filePath: string;
  bytesWritten: number;
}

const activeWriters = new Map<string, SessionWriter>();
const sessionSegments = new Map<string, string[]>();

function recordingDir(): string {
  return process.env.LIVE_RECORDING_DIR || '/tmp/recordings';
}

function existingSegments(liveSessionId: string): string[] {
  return (sessionSegments.get(liveSessionId) || []).filter((file) => existsSync(file));
}

function closeWriter(writer: SessionWriter): Promise<void> {
  return new Promise<void>((resolve) => {
    if (writer.stream.closed || writer.stream.destroyed) {
      resolve();
      return;
    }
    writer.stream.end(() => {
      resolve();
    });
  });
}

export const ffmpegBridge = {
  isActive(liveSessionId: string): boolean {
    return activeWriters.has(liveSessionId);
  },

  startTranscoding(liveSessionId: string, logger: Logger): void {
    if (activeWriters.has(liveSessionId)) {
      logger.info({ liveSessionId }, 'Session recording writer already active');
      return;
    }

    mkdirSync(recordingDir(), { recursive: true });
    const segments = sessionSegments.get(liveSessionId) || [];
    const outFile = path.join(recordingDir(), `${liveSessionId}.part${segments.length}.webm`);
    segments.push(outFile);
    sessionSegments.set(liveSessionId, segments);

    if (existsSync(outFile)) {
      try {
        unlinkSync(outFile);
      } catch {
        // continue
      }
    }

    logger.info({ liveSessionId, outFile }, 'Opening direct disk recording stream');

    const stream = createWriteStream(outFile, { flags: 'w' });
    stream.on('error', (err) => {
      logger.error(err, `Error writing session recording stream for ${liveSessionId}`);
    });

    activeWriters.set(liveSessionId, {
      stream,
      filePath: outFile,
      bytesWritten: 0,
    });
  },

  async rotateTranscoding(liveSessionId: string, logger: Logger): Promise<void> {
    const writer = activeWriters.get(liveSessionId);
    if (writer) {
      logger.info({ liveSessionId, bytes: writer.bytesWritten }, 'Rotating session recording segment');
      await closeWriter(writer);
      activeWriters.delete(liveSessionId);
    }
    this.startTranscoding(liveSessionId, logger);
  },

  writeChunk(liveSessionId: string, chunk: Buffer, logger: Logger): void {
    let writer = activeWriters.get(liveSessionId);
    if (!writer) {
      this.startTranscoding(liveSessionId, logger);
      writer = activeWriters.get(liveSessionId);
    }

    if (!writer || writer.stream.destroyed || writer.stream.closed) {
      logger.warn({ liveSessionId }, 'Dropping chunk; recording stream is unavailable');
      return;
    }

    const payload = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer);
    writer.bytesWritten += payload.length;
    writer.stream.write(payload);
  },

  async stopTranscoding(liveSessionId: string, logger: Logger): Promise<string[]> {
    const writer = activeWriters.get(liveSessionId);
    if (writer) {
      logger.info({ liveSessionId, bytes: writer.bytesWritten }, 'Closing session recording writer');
      await closeWriter(writer);
      activeWriters.delete(liveSessionId);
    }
    return existingSegments(liveSessionId);
  },

  cleanupSessionFiles(liveSessionId: string): void {
    for (const file of existingSegments(liveSessionId)) {
      try {
        unlinkSync(file);
      } catch {
        // ignore cleanup errors
      }
    }
    sessionSegments.delete(liveSessionId);
    activeWriters.delete(liveSessionId);
  },
};
