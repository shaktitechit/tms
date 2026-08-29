import { describe, expect, it, vi } from 'vitest';

vi.mock('bullmq', () => {
  class Queue {
    name: string;
    options: unknown;
    add = vi.fn(async (_name: string, data: unknown, opts: { jobId?: string }) => ({
      id: opts.jobId,
      data,
    }));
    getJob = vi.fn(async () => null);
    constructor(name: string, options: unknown) {
      this.name = name;
      this.options = options;
    }
  }
  return { Queue };
});

import {
  createSessionRecordingQueue,
  createVideoProcessingQueue,
  enqueueSessionRecording,
  enqueueVideoProcessing,
} from './server/queue.js';

describe('video processing queue', () => {
  it('enqueues jobs with a deterministic job id and retry backoff', async () => {
    const queue = createVideoProcessingQueue({
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
    });
    const id = await enqueueVideoProcessing(queue, '66c9e8abc1234567890abcde');
    expect(id).toBe('66c9e8abc1234567890abcde');
    expect(queue.add).toHaveBeenCalledWith(
      'process-video',
      { videoId: '66c9e8abc1234567890abcde' },
      expect.objectContaining({
        jobId: '66c9e8abc1234567890abcde',
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }),
    );
  });

  it('enqueues session recording jobs with the session id', async () => {
    const queue = createSessionRecordingQueue({
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
    });
    const data = {
      liveSessionId: '66c9e8abc1234567890abcde',
      tenantId: '66c9e8abc1234567890abcdf',
      hostId: '66c9e8abc1234567890abce0',
      title: 'Weekly standup',
      description: '',
      segmentKeys: ['live-sessions/66c9e8abc1234567890abcde/segments/part000.mp4'],
    };
    const id = await enqueueSessionRecording(queue, data);
    expect(id).toBe(data.liveSessionId);
    expect(queue.add).toHaveBeenCalledWith(
      'finalize-session-recording',
      data,
      expect.objectContaining({
        jobId: data.liveSessionId,
        attempts: 3,
      }),
    );
  });
});
