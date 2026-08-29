import { UnrecoverableError, type Job } from 'bullmq';
import { UnrecoverableProcessingError, type SessionRecordingJobData } from '@video/shared';
import {
  markSessionRecordingFailed,
  processSessionRecordingJob,
  type SessionRecordingDeps,
} from './services/session-recording.js';

export function createSessionRecordingProcessor(deps: SessionRecordingDeps) {
  return async (job: Job<SessionRecordingJobData>): Promise<void> => {
    const attempts = job.opts.attempts ?? 1;
    try {
      await processSessionRecordingJob(job, deps);
    } catch (error) {
      deps.logger.error(
        {
          liveSessionId: job.data.liveSessionId,
          jobId: job.id,
          err: error,
          attempt: job.attemptsMade + 1,
        },
        'Session recording job failed',
      );

      const unrecoverable = error instanceof UnrecoverableProcessingError;
      const lastAttempt = job.attemptsMade + 1 >= attempts;

      if (unrecoverable || lastAttempt) {
        await markSessionRecordingFailed(job.data.liveSessionId, error, deps.logger);
      }

      if (unrecoverable) {
        throw new UnrecoverableError(
          error instanceof Error ? error.message : 'Unrecoverable session recording error',
        );
      }
      throw error;
    }
  };
}
