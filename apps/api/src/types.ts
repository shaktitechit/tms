import type { Queue } from 'bullmq';
import type { AppEnv, Logger, StorageService } from '@video/shared/server';
import type { AudioProcessingJobData, SessionRecordingJobData, VideoProcessingJobData } from '@video/shared';

export interface AppContext {
  env: AppEnv;
  logger: Logger;
  storage: StorageService;
  queue: Queue<VideoProcessingJobData>;
  audioQueue: Queue<AudioProcessingJobData>;
  sessionRecordingQueue: Queue<SessionRecordingJobData>;
}
