import { beforeEach, describe, expect, it, vi } from 'vitest';

const runCommand = vi.fn();

vi.mock('./command.js', () => ({
  runCommand: (...args: unknown[]) => runCommand(...args),
}));

import { downloadYoutubeVideo } from './youtube-download.js';

describe('downloadYoutubeVideo', () => {
  beforeEach(() => {
    runCommand.mockReset();
    runCommand.mockResolvedValue({ stdout: '', stderr: '' });
  });

  it('invokes yt-dlp with a watch URL and mp4 output', async () => {
    const logger = { info: vi.fn() } as never;
    await downloadYoutubeVideo({
      youtubeVideoId: 'dQw4w9WgXcQ',
      outputPath: '/tmp/job/source.mp4',
      logger,
    });

    expect(runCommand).toHaveBeenCalledWith(
      'yt-dlp',
      expect.objectContaining({
        cwd: '/tmp/job',
        args: expect.arrayContaining([
          '-o',
          'source.mp4',
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        ]),
      }),
      logger,
    );
  });
});
