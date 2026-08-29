import { createReadStream, existsSync, statSync } from 'fs';
import mongoose from 'mongoose';
import { buildLiveSessionRecordingKeys } from '@video/shared';
import { enqueueSessionRecording } from '@video/shared/server';
import { liveSessionRepository } from './live-session.repository.js';
import { ffmpegBridge } from './ffmpeg.js';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { AppContext } from '../../types.js';

const MIN_SEGMENT_BYTES = 4_000;

let ctxRef: AppContext | null = null;

export function initLiveSessionRecording(ctx: AppContext) {
  ctxRef = ctx;
}

export async function markSessionRecording(liveSessionId: string) {
  const session = await liveSessionRepository.findById(liveSessionId);
  if (!session) return;
  if (session.recordingStatus === 'ready' || session.recordingStatus === 'processing') return;
  await liveSessionRepository.updateById(liveSessionId, String(session.tenantId), {
    recordingStatus: 'recording',
  } as any);
}

export async function finalizeSessionRecording(liveSessionId: string) {
  if (!ctxRef) return;
  if (!mongoose.Types.ObjectId.isValid(liveSessionId)) return;

  const claimed = await mongoRegistry.models.LiveSession.findOneAndUpdate(
    { _id: liveSessionId, recordingStatus: { $nin: ['processing', 'ready'] } },
    { recordingStatus: 'processing' },
    { new: true },
  )
    .populate('hostId', 'name username')
    .lean();
  if (!claimed) return;

  const session = claimed;
  const tenantId = String(session.tenantId);
  const logger = ctxRef.logger;

  try {
    const rawPaths = await ffmpegBridge.stopTranscoding(liveSessionId, logger);
    const usable = rawPaths.filter((file) => existsSync(file) && statSync(file).size >= MIN_SEGMENT_BYTES);
    if (usable.length === 0) {
      logger.warn({ liveSessionId, rawPaths }, 'Recording too small or missing; skipping upload');
      await liveSessionRepository.updateById(liveSessionId, tenantId, {
        recordingStatus: 'none',
      } as any);
      ffmpegBridge.cleanupSessionFiles(liveSessionId);
      return;
    }

    const keys = buildLiveSessionRecordingKeys(liveSessionId);
    const segmentKeys: string[] = [];
    for (const [index, file] of usable.entries()) {
      const key = keys.segmentKey(index);
      const contentType = file.endsWith('.webm') ? 'video/webm' : 'video/mp4';
      await ctxRef.storage.upload(key, createReadStream(file), {
        contentType,
        contentLength: statSync(file).size,
      });
      segmentKeys.push(key);
    }

    ffmpegBridge.cleanupSessionFiles(liveSessionId);

    const hostId = String((session.hostId as any)?._id || session.hostId);
    await enqueueSessionRecording(ctxRef.sessionRecordingQueue, {
      liveSessionId,
      tenantId,
      hostId,
      title: `${session.title} (Recording)`,
      description: session.description || '',
      segmentKeys,
    });

    logger.info({ liveSessionId, segments: segmentKeys.length }, 'Enqueued session recording job');
  } catch (err) {
    logger.error(err, `Failed to hand off recording for session ${liveSessionId}`);
    await liveSessionRepository.updateById(liveSessionId, tenantId, {
      recordingStatus: 'failed',
    } as any);
    ffmpegBridge.cleanupSessionFiles(liveSessionId);
  }
}
