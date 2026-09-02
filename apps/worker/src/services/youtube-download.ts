import path from 'node:path';
import { DEFAULT_VIDEO_MAX_SIZE, youtubeWatchUrl } from '@video/shared';
import type { Logger } from '@video/shared/server';
import { runCommand } from './command.js';

const DOWNLOAD_TIMEOUT_MS = 20 * 60 * 1000;

export async function downloadYoutubeVideo(input: {
  youtubeVideoId: string;
  outputPath: string;
  logger: Logger;
  maxSize?: number;
}): Promise<void> {
  const maxSize = input.maxSize ?? DEFAULT_VIDEO_MAX_SIZE;
  const outputDir = path.dirname(input.outputPath);
  const outputName = path.basename(input.outputPath);

  await runCommand(
    'yt-dlp',
    {
      cwd: outputDir,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      args: [
        '--no-playlist',
        '--no-mtime',
        '--newline',
        '--merge-output-format',
        'mp4',
        '-f',
        'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b',
        '--max-filesize',
        `${Math.max(1, Math.floor(maxSize / (1024 * 1024)))}M`,
        '-o',
        outputName,
        youtubeWatchUrl(input.youtubeVideoId),
      ],
    },
    input.logger,
  );
}
