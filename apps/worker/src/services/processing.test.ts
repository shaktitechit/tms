import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnrecoverableProcessingError, VideoStatus } from '@video/shared';

const findByIdAndUpdate = vi.fn();

vi.mock('@video/shared/server', async () => {
  const actual = await vi.importActual<typeof import('@video/shared/server')>('@video/shared/server');
  return {
    ...actual,
    Video: {
      findByIdAndUpdate: (...args: unknown[]) => findByIdAndUpdate(...args),
    },
  };
});

import { markVideoFailed } from './processing.js';

describe('processing failure', () => {
  beforeEach(() => {
    findByIdAndUpdate.mockReset();
    findByIdAndUpdate.mockResolvedValue({});
  });

  it('stores a FAILED status and error message', async () => {
    const logger = { error: vi.fn() } as never;
    await markVideoFailed(
      '66c9e8abc1234567890abcde',
      new UnrecoverableProcessingError('FFmpeg exploded', 'invalid codec'),
      logger,
    );
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      '66c9e8abc1234567890abcde',
      expect.objectContaining({
        status: VideoStatus.FAILED,
        errorMessage: expect.stringContaining('FFmpeg exploded'),
      }),
    );
  });
});
