import { UnrecoverableError, type Job } from 'bullmq';
import { UnrecoverableProcessingError, type AudioProcessingJobData } from '@video/shared';
import {
  markAudioFailed,
  processAudioJob,
  type AudioProcessingDeps,
} from './services/audio-processing.js';

export function createAudioProcessor(deps: AudioProcessingDeps) {
  return async (job: Job<AudioProcessingJobData>): Promise<void> => {
    const attempts = job.opts.attempts ?? 1;
    try {
      await processAudioJob(job, deps);
    } catch (error) {
      const stderr =
        error instanceof UnrecoverableProcessingError
          ? error.stderr
          : error && typeof error === 'object' && 'stderr' in error
            ? String(error.stderr)
            : undefined;

      deps.logger.error(
        {
          audioId: job.data.audioId,
          jobId: job.id,
          err: error,
          stderr,
          attempt: job.attemptsMade + 1,
        },
        'Audio processing job failed',
      );

      const unrecoverable = error instanceof UnrecoverableProcessingError;
      const lastAttempt = job.attemptsMade + 1 >= attempts;

      if (unrecoverable || lastAttempt) {
        await markAudioFailed(job.data.audioId, error, deps.logger);
      }

      if (unrecoverable) {
        throw new UnrecoverableError(
          error instanceof Error ? error.message : 'Unrecoverable processing error',
        );
      }
      throw error;
    }
  };
}
