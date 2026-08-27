import { UnrecoverableProcessingError } from '@video/shared';
import type { Logger } from '@video/shared/server';
import { runCommand } from './command.js';

export async function generateThumbnail(input: {
  sourcePath: string;
  outputPath: string;
  duration: number;
  logger: Logger;
}): Promise<void> {
  const timestamp = Math.max(0.1, input.duration * 0.1);
  try {
    await runCommand(
      'ffmpeg',
      {
        args: [
          '-y',
          '-ss',
          timestamp.toFixed(3),
          '-i',
          input.sourcePath,
          '-frames:v',
          '1',
          '-q:v',
          '2',
          input.outputPath,
        ],
      },
      input.logger,
    );
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : undefined;
    throw new UnrecoverableProcessingError('Failed to generate thumbnail', stderr);
  }
}
