import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Job } from 'bullmq';
import {
  AudioStatus,
  HLS_CONTENT_TYPES,
  UnrecoverableProcessingError,
  audioQualitiesForSource,
  buildAudioStorageKeys,
  type AudioProcessingJobData,
} from '@video/shared';
import { Audio, type Logger, type StorageService } from '@video/shared/server';
import { cleanupDir, createJobTempDir } from '../utils/temp.js';
import { probeAudio } from './audio-probe.js';
import { transcodeAudioVariant, writeAudioMasterPlaylist } from './audio-hls.js';

export interface AudioProcessingDeps {
  storage: StorageService;
  logger: Logger;
  tempRoot: string;
  segmentDuration: number;
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
  audioId: string,
  job: Job<AudioProcessingJobData>,
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
  await Audio.findByIdAndUpdate(audioId, {
    processingProgress: clamped,
    status: AudioStatus.PROCESSING,
  });
  await job.updateProgress(clamped);
  logger.info({ audioId, jobId: job.id, stage, progress: clamped }, 'Audio processing progress');
}

export async function processAudioJob(
  job: Job<AudioProcessingJobData>,
  deps: AudioProcessingDeps,
): Promise<void> {
  const audioId = job.data.audioId;
  const started = Date.now();
  const logger = deps.logger.child({ audioId, jobId: job.id, attempt: job.attemptsMade + 1 });

  logger.info({ stage: 'start' }, 'Audio processing started');

  const audio = await Audio.findById(audioId);
  if (!audio) {
    throw new UnrecoverableProcessingError(`Audio ${audioId} was not found`);
  }

  audio.status = AudioStatus.PROCESSING;
  audio.processingProgress = 1;
  audio.errorMessage = undefined;
  await audio.save();
  await job.updateProgress(1);

  const tempDir = await createJobTempDir(deps.tempRoot, audioId, String(job.id ?? 'job'));
  const ext = path.extname(audio.originalFilename || audio.storageKey);
  const keys = buildAudioStorageKeys(audioId, ext);

  try {
    const sourcePath = path.join(tempDir, `source${ext || '.bin'}`);
    logger.info({ stage: 'download', key: audio.storageKey }, 'Downloading original audio');
    await deps.storage.downloadToFile(audio.storageKey, sourcePath);
    await setProgress(audioId, job, 10, 'download', logger);

    logger.info({ stage: 'probe' }, 'Inspecting audio with ffprobe');
    const probe = await probeAudio(sourcePath, logger);
    audio.duration = probe.duration;
    await audio.save();
    logger.info(
      {
        stage: 'probe',
        duration: probe.duration,
        codec: probe.codec,
        bitrate: probe.bitrate,
        sampleRate: probe.sampleRate,
        channels: probe.channels,
      },
      'Audio probe complete',
    );
    await setProgress(audioId, job, 18, 'probe', logger);

    const ladder = audioQualitiesForSource(probe.bitrate);
    logger.info(
      { stage: 'transcode', qualities: ladder.map((item) => item.name) },
      'Starting audio HLS transcode',
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
      logger.info({ stage: 'transcode', quality: variant.name }, 'Transcoding audio variant');
      const result = await transcodeAudioVariant({
        sourcePath,
        workDir: tempDir,
        variant,
        probe,
        segmentDuration: deps.segmentDuration,
        logger,
        onProgress: (seconds) => {
          const ratio = probe.duration > 0 ? Math.min(1, seconds / probe.duration) : 0;
          void setProgress(
            audioId,
            job,
            variantStart + ratio * variantSize,
            `transcode:${variant.name}`,
            logger,
            throttle,
          );
        },
      });
      variants.push(result);
      await setProgress(
        audioId,
        job,
        variantStart + variantSize,
        `transcode:${variant.name}:done`,
        logger,
      );
    }

    await writeAudioMasterPlaylist(tempDir, variants);
    await setProgress(audioId, job, 90, 'master-playlist', logger);

    logger.info({ stage: 'upload' }, 'Uploading audio HLS assets');
    await uploadDirectory(deps.storage, path.join(tempDir, 'hls'), keys.hlsPrefix);

    audio.hlsMasterPlaylistKey = keys.hlsMaster;
    audio.availableQualities = variants.map((variant) => variant.quality.name);
    audio.status = AudioStatus.READY;
    audio.processingProgress = 100;
    audio.errorMessage = undefined;
    await audio.save();
    await job.updateProgress(100);

    logger.info(
      {
        stage: 'complete',
        elapsedMs: Date.now() - started,
        qualities: audio.availableQualities,
      },
      'Audio processing complete',
    );
  } finally {
    await cleanupDir(tempDir).catch((error) => {
      logger.warn({ err: error, tempDir }, 'Failed to clean temporary audio files');
    });
  }
}

export async function markAudioFailed(
  audioId: string,
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

  logger.error({ audioId, err: error, stderr }, 'Marking audio FAILED');
  await Audio.findByIdAndUpdate(audioId, {
    status: AudioStatus.FAILED,
    errorMessage: stderr ? `${message}: ${stderr.slice(0, 2000)}` : message,
  });
}
