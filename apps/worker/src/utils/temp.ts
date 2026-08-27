import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

export async function createJobTempDir(baseDir: string, videoId: string, jobId: string): Promise<string> {
  const dir = path.join(baseDir, `${videoId}-${jobId}-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function cleanupDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
