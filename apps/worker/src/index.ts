import { Worker } from 'bullmq';
import {
  AUDIO_PROCESSING_QUEUE,
  VIDEO_PROCESSING_QUEUE,
  type AudioProcessingJobData,
  type VideoProcessingJobData,
} from '@video/shared';
import {
  connectMongo,
  createLogger,
  createRedisConnection,
  loadEnv,
  S3CompatibleStorage,
} from '@video/shared/server';
import { createAudioProcessor } from './audio-processor.js';
import { createVideoProcessor } from './processor.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger('worker', env.LOG_LEVEL);
  const storage = new S3CompatibleStorage(env, logger);

  await connectMongo(env.MONGO_URI, logger);
  await storage.ensureBucket();

  const connection = createRedisConnection(env);
  const videoProcessor = createVideoProcessor({
    storage,
    logger,
    tempRoot: env.WORKER_TEMP_DIR,
    segmentDuration: env.HLS_SEGMENT_DURATION,
    preset: env.FFMPEG_PRESET,
    crf: env.FFMPEG_CRF,
  });
  const audioProcessor = createAudioProcessor({
    storage,
    logger,
    tempRoot: env.WORKER_TEMP_DIR,
    segmentDuration: env.HLS_SEGMENT_DURATION,
  });

  const videoWorker = new Worker<VideoProcessingJobData>(VIDEO_PROCESSING_QUEUE, videoProcessor, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    lockDuration: 5 * 60 * 1000,
    stalledInterval: 60 * 1000,
  });

  const audioWorker = new Worker<AudioProcessingJobData>(AUDIO_PROCESSING_QUEUE, audioProcessor, {
    connection: createRedisConnection(env),
    concurrency: Math.max(1, Math.floor(env.WORKER_CONCURRENCY)),
    lockDuration: 5 * 60 * 1000,
    stalledInterval: 60 * 1000,
  });

  videoWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, videoId: job.data.videoId }, 'Video job completed');
  });
  videoWorker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, videoId: job?.data.videoId, err: error },
      'Video job failed',
    );
  });
  videoWorker.on('error', (error) => {
    logger.error({ err: error }, 'Video worker error');
  });

  audioWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, audioId: job.data.audioId }, 'Audio job completed');
  });
  audioWorker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, audioId: job?.data.audioId, err: error },
      'Audio job failed',
    );
  });
  audioWorker.on('error', (error) => {
    logger.error({ err: error }, 'Audio worker error');
  });

  logger.info(
    {
      concurrency: env.WORKER_CONCURRENCY,
      videoQueue: VIDEO_PROCESSING_QUEUE,
      audioQueue: AUDIO_PROCESSING_QUEUE,
    },
    'Video and audio workers started',
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down worker');
    await Promise.all([videoWorker.close(), audioWorker.close()]);
    await connection.quit();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
