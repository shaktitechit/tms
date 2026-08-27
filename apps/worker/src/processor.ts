import { UnrecoverableError, type Job } from 'bullmq';
import {
  UnrecoverableProcessingError,
  type VideoProcessingJobData,
} from '@video/shared';
import { markVideoFailed, processVideoJob, type ProcessingDeps } from './services/processing.js';

export function createVideoProcessor(deps: ProcessingDeps) {
  return async (job: Job<VideoProcessingJobData>): Promise<void> => {
    const attempts = job.opts.attempts ?? 1;
    try {
      await processVideoJob(job, deps);
    } catch (error) {
      const stderr =
        error instanceof UnrecoverableProcessingError
          ? error.stderr
          : error && typeof error === 'object' && 'stderr' in error
            ? String(error.stderr)
            : undefined;

      deps.logger.error(
        {
          videoId: job.data.videoId,
          jobId: job.id,
          err: error,
          stderr,
          attempt: job.attemptsMade + 1,
        },
        'Video processing job failed',
      );

      const unrecoverable = error instanceof UnrecoverableProcessingError;
      const lastAttempt = job.attemptsMade + 1 >= attempts;

      if (unrecoverable || lastAttempt) {
        await markVideoFailed(job.data.videoId, error, deps.logger);
      }

      if (unrecoverable) {
        throw new UnrecoverableError(error instanceof Error ? error.message : 'Unrecoverable processing error');
      }
      throw error;
    }
  };
}
