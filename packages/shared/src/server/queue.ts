import { Queue, type JobsOptions } from 'bullmq';
import { Redis, type RedisOptions } from 'ioredis';
import {
  AUDIO_PROCESSING_QUEUE,
  SESSION_RECORDING_QUEUE,
  VIDEO_PROCESSING_QUEUE,
  type AudioProcessingJobData,
  type SessionRecordingJobData,
  type VideoProcessingJobData,
} from '../types.js';
import type { AppEnv } from './env.js';

export function redisOptions(env: Pick<AppEnv, 'REDIS_HOST' | 'REDIS_PORT' | 'REDIS_PASSWORD'>): RedisOptions {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
}

export function createRedisConnection(
  env: Pick<AppEnv, 'REDIS_HOST' | 'REDIS_PORT' | 'REDIS_PASSWORD'>,
): Redis {
  return new Redis(redisOptions(env));
}

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5_000,
  },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 200 },
};

export function createVideoProcessingQueue(
  env: Pick<AppEnv, 'REDIS_HOST' | 'REDIS_PORT' | 'REDIS_PASSWORD'>,
): Queue<VideoProcessingJobData> {
  return new Queue<VideoProcessingJobData>(VIDEO_PROCESSING_QUEUE, {
    connection: redisOptions(env),
    defaultJobOptions,
  });
}

export async function enqueueVideoProcessing(
  queue: Queue<VideoProcessingJobData>,
  videoId: string,
): Promise<string> {
  const job = await queue.add(
    'process-video',
    { videoId },
    {
      jobId: videoId,
      ...defaultJobOptions,
    },
  );
  return job.id ?? videoId;
}

export async function removeVideoProcessingJob(
  queue: Queue<VideoProcessingJobData>,
  videoId: string,
): Promise<void> {
  const job = await queue.getJob(videoId);
  if (job) {
    const state = await job.getState();
    if (state === 'active') {
      await job.moveToFailed(new Error('Video deleted'), '0', true).catch(() => undefined);
    }
    await job.remove().catch(() => undefined);
  }
}

export function createAudioProcessingQueue(
  env: Pick<AppEnv, 'REDIS_HOST' | 'REDIS_PORT' | 'REDIS_PASSWORD'>,
): Queue<AudioProcessingJobData> {
  return new Queue<AudioProcessingJobData>(AUDIO_PROCESSING_QUEUE, {
    connection: redisOptions(env),
    defaultJobOptions,
  });
}

export async function enqueueAudioProcessing(
  queue: Queue<AudioProcessingJobData>,
  audioId: string,
): Promise<string> {
  const job = await queue.add(
    'process-audio',
    { audioId },
    {
      jobId: audioId,
      ...defaultJobOptions,
    },
  );
  return job.id ?? audioId;
}

export async function removeAudioProcessingJob(
  queue: Queue<AudioProcessingJobData>,
  audioId: string,
): Promise<void> {
  const job = await queue.getJob(audioId);
  if (job) {
    const state = await job.getState();
    if (state === 'active') {
      await job.moveToFailed(new Error('Audio deleted'), '0', true).catch(() => undefined);
    }
    await job.remove().catch(() => undefined);
  }
}

export function createSessionRecordingQueue(
  env: Pick<AppEnv, 'REDIS_HOST' | 'REDIS_PORT' | 'REDIS_PASSWORD'>,
): Queue<SessionRecordingJobData> {
  return new Queue<SessionRecordingJobData>(SESSION_RECORDING_QUEUE, {
    connection: redisOptions(env),
    defaultJobOptions,
  });
}

export async function enqueueSessionRecording(
  queue: Queue<SessionRecordingJobData>,
  data: SessionRecordingJobData,
): Promise<string> {
  const job = await queue.add('finalize-session-recording', data, {
    jobId: data.liveSessionId,
    ...defaultJobOptions,
  });
  return job.id ?? data.liveSessionId;
}

export async function removeSessionRecordingJob(
  queue: Queue<SessionRecordingJobData>,
  liveSessionId: string,
): Promise<void> {
  const job = await queue.getJob(liveSessionId);
  if (job) {
    const state = await job.getState();
    if (state === 'active') {
      await job.moveToFailed(new Error('Live session recording cancelled'), '0', true).catch(() => undefined);
    }
    await job.remove().catch(() => undefined);
  }
}
