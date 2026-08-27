import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Job } from 'bullmq';
import {
  HLS_CONTENT_TYPES,
  UnrecoverableProcessingError,
  VideoStatus,
  buildStorageKeys,
  qualitiesForSource,
  type VideoProcessingJobData,
} from '@video/shared';
import { Video, type Logger, type StorageService } from '@video/shared/server';
import { cleanupDir, createJobTempDir } from '../utils/temp.js';
import { transcodeVariant, writeMasterPlaylist } from './hls.js';
import { probeVideo } from './probe.js';
import { generateThumbnail } from './thumbnail.js';

export interface ProcessingDeps {
  storage: StorageService;
  logger: Logger;
  tempRoot: string;
  segmentDuration: number;
  preset: string;
  crf: number;
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function uploadDirectory(
  storage: StorageService,
  localDir: string,
  keyPrefix: string,
): Promise<void> {
  const files = await walkFiles(localDir);
  for (const file of files) {
    const relative = path.relative(localDir, file).replaceAll('\\', '/');
    const extension = path.extname(file).toLowerCase();
    await storage.uploadFile(file, `${keyPrefix}/${relative}`, HLS_CONTENT_TYPES[extension]);
  }
}

async function setProgress(
  videoId: string,
  job: Job<VideoProcessingJobData>,
  progress: number,
  stage: string,
  logger: Logger,
  throttle?: { lastWrite: number; lastProgress: number },
): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const now = Date.now();
  if (
    throttle &&
    clamped < 100 &&
    now - throttle.lastWrite < 1000 &&
    Math.abs(clamped - throttle.lastProgress) < 2
  ) {
    return;
  }
  if (throttle) {
    throttle.lastWrite = now;
    throttle.lastProgress = clamped;
  }
  await Video.findByIdAndUpdate(videoId, { processingProgress: clamped, status: VideoStatus.PROCESSING });
  await job.updateProgress(clamped);
  logger.info({ videoId, jobId: job.id, stage, progress: clamped }, 'Processing progress');
}

export async function processVideoJob(
  job: Job<VideoProcessingJobData>,
  deps: ProcessingDeps,
): Promise<void> {
  const videoId = job.data.videoId;
  const started = Date.now();
  const logger = deps.logger.child({ videoId, jobId: job.id, attempt: job.attemptsMade + 1 });

  logger.info({ stage: 'start' }, 'Video processing started');

  const video = await Video.findById(videoId);
  if (!video) {
    throw new UnrecoverableProcessingError(`Video ${videoId} was not found`);
  }

  video.status = VideoStatus.PROCESSING;
  video.processingProgress = 1;
  video.errorMessage = undefined;
  await video.save();
  await job.updateProgress(1);

  const tempDir = await createJobTempDir(deps.tempRoot, videoId, String(job.id ?? 'job'));
  const keys = buildStorageKeys(videoId);

  try {
    const sourcePath = path.join(tempDir, 'source.mp4');
    logger.info({ stage: 'download', key: video.originalStorageKey }, 'Downloading original');
    await deps.storage.downloadToFile(video.originalStorageKey, sourcePath);
    await setProgress(videoId, job, 8, 'download', logger);

    logger.info({ stage: 'probe' }, 'Inspecting source with ffprobe');
    const probe = await probeVideo(sourcePath, logger);
    video.duration = probe.duration;
    video.width = probe.width;
    video.height = probe.height;
    await video.save();
    logger.info(
      {
        stage: 'probe',
        duration: probe.duration,
        width: probe.width,
        height: probe.height,
        codec: probe.codec,
        bitrate: probe.bitrate,
        fps: probe.fps,
        hasAudio: probe.hasAudio,
      },
      'Source probe complete',
    );
    await setProgress(videoId, job, 12, 'probe', logger);

    const thumbnailPath = path.join(tempDir, 'thumbnail.jpg');
    logger.info({ stage: 'thumbnail' }, 'Generating thumbnail');
    await generateThumbnail({
      sourcePath,
      outputPath: thumbnailPath,
      duration: probe.duration,
      logger,
    });
    await deps.storage.uploadFile(thumbnailPath, keys.thumbnail, 'image/jpeg');
    video.thumbnailStorageKey = keys.thumbnail;
    await video.save();
    await setProgress(videoId, job, 18, 'thumbnail', logger);

    const ladder = qualitiesForSource(probe.width, probe.height);
    logger.info(
      { stage: 'transcode', qualities: ladder.map((item) => item.name) },
      'Starting HLS transcode',
    );

    const variants = [];
    const transcodeSpan = 70;
    const throttle = { lastWrite: 0, lastProgress: 0 };
    for (let index = 0; index < ladder.length; index += 1) {
      const variant = ladder[index];
      if (!variant) {
        continue;
      }
      const variantStart = 18 + (transcodeSpan / ladder.length) * index;
      const variantSize = transcodeSpan / ladder.length;
      logger.info({ stage: 'transcode', quality: variant.name }, 'Transcoding variant');
      const result = await transcodeVariant({
        sourcePath,
        workDir: tempDir,
        variant,
        probe,
        segmentDuration: deps.segmentDuration,
        preset: deps.preset,
        crf: deps.crf,
        logger,
        onProgress: (seconds) => {
          const ratio = probe.duration > 0 ? Math.min(1, seconds / probe.duration) : 0;
          void setProgress(
            videoId,
            job,
            variantStart + ratio * variantSize,
            `transcode:${variant.name}`,
            logger,
            throttle,
          );
        },
      });
      variants.push(result);
      await setProgress(videoId, job, variantStart + variantSize, `transcode:${variant.name}:done`, logger);
    }

    await writeMasterPlaylist(tempDir, variants);
    await setProgress(videoId, job, 90, 'master-playlist', logger);

    logger.info({ stage: 'upload' }, 'Uploading HLS assets');
    await uploadDirectory(deps.storage, path.join(tempDir, 'hls'), keys.hlsPrefix);

    video.hlsMasterPlaylistKey = keys.hlsMaster;
    video.availableQualities = variants.map((variant) => variant.quality.name);
    video.status = VideoStatus.READY;
    video.processingProgress = 100;
    video.errorMessage = undefined;
    await video.save();
    await job.updateProgress(100);

    logger.info(
      {
        stage: 'complete',
        elapsedMs: Date.now() - started,
        qualities: video.availableQualities,
      },
      'Video processing complete',
    );
  } finally {
    await cleanupDir(tempDir).catch((error) => {
      logger.warn({ err: error, tempDir }, 'Failed to clean temporary files');
    });
  }
}

export async function markVideoFailed(
  videoId: string,
  error: unknown,
  logger: Logger,
): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown processing error';
  const stderr =
    error instanceof UnrecoverableProcessingError
      ? error.stderr
      : error && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr)
        : undefined;

  logger.error({ videoId, err: error, stderr }, 'Marking video FAILED');
  await Video.findByIdAndUpdate(videoId, {
    status: VideoStatus.FAILED,
    errorMessage: stderr ? `${message}: ${stderr.slice(0, 2000)}` : message,
  });
}
