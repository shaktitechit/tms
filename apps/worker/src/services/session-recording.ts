import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { Job, Queue } from 'bullmq';
import {
  UnrecoverableProcessingError,
  VideoStatus,
  VideoVisibility,
  buildLiveSessionRecordingKeys,
  buildStorageKeys,
  slugifySegment,
  type SessionRecordingJobData,
  type VideoProcessingJobData,
} from '@video/shared';
import { LiveSession, Video, enqueueVideoProcessing, type Logger, type StorageService } from '@video/shared/server';
import { cleanupDir, createJobTempDir } from '../utils/temp.js';
import { remuxSessionSegments } from './session-recording-remux.js';

export interface SessionRecordingDeps {
  storage: StorageService;
  logger: Logger;
  tempRoot: string;
  videoQueue: Queue<VideoProcessingJobData>;
}

async function markSessionFailed(liveSessionId: string, error: unknown, logger: Logger) {
  const message = error instanceof Error ? error.message : 'Session recording failed';
  logger.error({ liveSessionId, err: error }, 'Marking live session recording failed');
  await LiveSession.findByIdAndUpdate(liveSessionId, { recordingStatus: 'failed' });
  return message;
}

export async function processSessionRecordingJob(
  job: Job<SessionRecordingJobData>,
  deps: SessionRecordingDeps,
): Promise<void> {
  const { liveSessionId, tenantId, hostId, title, description, segmentKeys } = job.data;
  const logger = deps.logger.child({
    liveSessionId,
    jobId: job.id,
    attempt: job.attemptsMade + 1,
  });

  const session = await LiveSession.findById(liveSessionId);
  if (!session) {
    throw new UnrecoverableProcessingError(`Live session ${liveSessionId} was not found`);
  }

  if (session.recordingVideoId) {
    const existing = await Video.findById(session.recordingVideoId);
    if (existing && existing.status !== VideoStatus.FAILED) {
      if (
        existing.status === VideoStatus.UPLOADED ||
        existing.status === VideoStatus.UPLOADING ||
        existing.status === VideoStatus.QUEUED
      ) {
        await enqueueVideoProcessing(deps.videoQueue, String(existing._id));
        existing.status = VideoStatus.QUEUED;
        await existing.save();
      }
      session.recordingStatus = 'processing';
      await session.save();
      logger.info({ videoId: String(existing._id) }, 'Session recording already uploaded; ensuring HLS job');
      return;
    }
  }

  if (!segmentKeys.length) {
    throw new UnrecoverableProcessingError('Session recording job has no segments');
  }

  session.recordingStatus = 'processing';
  await session.save();

  const tempDir = await createJobTempDir(deps.tempRoot, liveSessionId, String(job.id ?? 'job'));
  try {
    const localSegments: string[] = [];
    for (const [index, key] of segmentKeys.entries()) {
      const dest = path.join(tempDir, `part${String(index).padStart(3, '0')}.mp4`);
      await deps.storage.downloadToFile(key, dest);
      localSegments.push(dest);
    }

    const remuxed = await remuxSessionSegments(liveSessionId, localSegments, tempDir, logger);
    const fileSize = (await stat(remuxed)).size;
    if (fileSize < 16_000) {
      throw new UnrecoverableProcessingError('Remuxed session recording is too small');
    }

    const slug = `${slugifySegment(title, 'recording')}-${String(liveSessionId).slice(-8)}`;
    const video = new Video({
      title,
      slug,
      description,
      originalFilename: `session-${liveSessionId}.mp4`,
      originalStorageKey: 'pending',
      status: VideoStatus.UPLOADING,
      processingProgress: 0,
      fileSize,
      mimeType: 'video/mp4',
      visibility: VideoVisibility.UNLISTED,
      createdBy: hostId,
      tenantId,
      availableQualities: [],
    });
    const keys = buildStorageKeys(String(video._id));
    video.originalStorageKey = keys.original;
    await video.save();

    await deps.storage.uploadFile(remuxed, keys.original, 'video/mp4');
    video.status = VideoStatus.UPLOADED;
    await video.save();

    await enqueueVideoProcessing(deps.videoQueue, String(video._id));
    video.status = VideoStatus.QUEUED;
    await video.save();

    session.recordingVideoId = video._id;
    session.recordingStatus = 'processing';
    await session.save();

    const recordingKeys = buildLiveSessionRecordingKeys(liveSessionId);
    await deps.storage.deletePrefix(recordingKeys.prefix);

    logger.info({ videoId: String(video._id), fileSize }, 'Session recording handed to HLS pipeline');
  } finally {
    await cleanupDir(tempDir);
  }
}

export async function markSessionRecordingFailed(
  liveSessionId: string,
  error: unknown,
  logger: Logger,
): Promise<void> {
  await markSessionFailed(liveSessionId, error, logger);
}
