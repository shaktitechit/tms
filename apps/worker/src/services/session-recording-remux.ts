import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Logger } from '@video/shared/server';
import { runCommand } from './command.js';

function encodeArgs(inputPath: string, outputPath: string, withAudio: boolean) {
  if (withAudio) {
    return [
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '24',
      '-fps_mode',
      'cfr',
      '-c:a',
      'aac',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-af',
      'aresample=async=1:first_pts=0',
      '-shortest',
      '-movflags',
      '+faststart',
      outputPath,
    ];
  }

  return [
    '-y',
    '-i',
    inputPath,
    '-f',
    'lavfi',
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '24',
    '-fps_mode',
    'cfr',
    '-c:a',
    'aac',
    '-shortest',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

async function tryEncode(args: string[], outputPath: string, logger: Logger, label: string) {
  try {
    await runCommand('ffmpeg', { args }, logger);
    return existsSync(outputPath);
  } catch (err) {
    logger.warn({ err, label }, 'Session recording remux step failed');
    return false;
  }
}

export async function remuxSessionSegments(
  liveSessionId: string,
  inputPaths: string[],
  workDir: string,
  logger: Logger,
): Promise<string> {
  const inputs = inputPaths.filter((file) => existsSync(file));
  if (inputs.length === 0) {
    throw new Error('No recording segments to remux');
  }

  const normalized: string[] = [];
  for (const [index, inputPath] of inputs.entries()) {
    const outputPath = path.join(workDir, `norm${index}.mp4`);
    const ok =
      (await tryEncode(encodeArgs(inputPath, outputPath, true), outputPath, logger, 'normalize-av')) ||
      (await tryEncode(encodeArgs(inputPath, outputPath, false), outputPath, logger, 'normalize-video'));
    if (ok) {
      normalized.push(outputPath);
    } else {
      logger.warn({ liveSessionId, inputPath }, 'Skipping recording segment that failed to normalize');
    }
  }

  const firstInput = inputs[0];
  const firstNormalized = normalized[0];
  if (!firstNormalized) {
    if (!firstInput) throw new Error('No recording segments to remux');
    logger.warn({ liveSessionId }, 'Remux failed; using first fragmented recording as-is');
    return firstInput;
  }

  if (normalized.length === 1) {
    return firstNormalized;
  }

  const listPath = path.join(workDir, 'concat.txt');
  writeFileSync(
    listPath,
    normalized.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n'),
  );

  const outputPath = path.join(workDir, 'final.mp4');
  const concatOk = await tryEncode(
    ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', outputPath],
    outputPath,
    logger,
    'concat',
  );

  if (concatOk) {
    return outputPath;
  }

  logger.warn({ liveSessionId }, 'Concat failed; using first normalized segment');
  return firstNormalized;
}
