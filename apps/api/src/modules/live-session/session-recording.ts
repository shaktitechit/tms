import { spawn } from 'child_process';
import { createReadStream, existsSync, statSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import {
  buildLiveSessionRecordingKeys,
  buildStorageKeys,
  slugifySegment,
  VideoStatus,
  VideoVisibility,
} from '@video/shared';
import { enqueueSessionRecording, enqueueVideoProcessing } from '@video/shared/server';
import { liveSessionRepository } from './live-session.repository.js';
import { ffmpegBridge } from './ffmpeg.js';
import { liveSessionEventEmitter, LiveSessionEvents } from './live-session.events.js';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { AppContext } from '../../types.js';

const MIN_SEGMENT_BYTES = 4_000;

let ctxRef: AppContext | null = null;

export function initLiveSessionRecording(ctx: AppContext) {
  ctxRef = ctx;
}

export async function markSessionRecording(liveSessionId: string) {
  const session = await liveSessionRepository.findById(liveSessionId);
  if (!session) return;
  if (session.recordingStatus === 'ready' || session.recordingStatus === 'processing') return;
  await liveSessionRepository.updateById(liveSessionId, String(session.tenantId), {
    recordingStatus: 'recording',
  } as any);
}

function runFfmpeg(args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // already gone
      }
      resolve(false);
    }, 25000);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });

    child.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function fastLocalRemux(usableSegments: string[], outFinalPath: string): Promise<boolean> {
  if (usableSegments.length === 0) return false;
  const firstInput = usableSegments[0];
  if (!firstInput) return false;

  if (usableSegments.length === 1) {
    const ok =
      (await runFfmpeg([
        '-y',
        '-i',
        firstInput,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
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
        outFinalPath,
      ])) ||
      (await runFfmpeg([
        '-y',
        '-i',
        firstInput,
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
        'ultrafast',
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
        outFinalPath,
      ]));
    return ok && existsSync(outFinalPath) && statSync(outFinalPath).size >= MIN_SEGMENT_BYTES;
  }

  // Multi-segment concat
  const normalizedParts: string[] = [];
  const dir = path.dirname(outFinalPath);
  for (const [idx, seg] of usableSegments.entries()) {
    const norm = path.join(dir, `norm_${idx}.mp4`);
    const ok =
      (await runFfmpeg([
        '-y',
        '-i',
        seg,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
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
        norm,
      ])) ||
      (await runFfmpeg([
        '-y',
        '-i',
        seg,
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
        'ultrafast',
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
        norm,
      ]));
    if (ok && existsSync(norm)) {
      normalizedParts.push(norm);
    }
  }

  if (normalizedParts.length === 0) return false;
  if (normalizedParts.length === 1) {
    const singleNorm = normalizedParts[0];
    return typeof singleNorm === 'string' && existsSync(singleNorm);
  }

  const listFile = path.join(dir, `concat_${Date.now()}.txt`);
  writeFileSync(listFile, normalizedParts.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  const concatOk = await runFfmpeg([
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    outFinalPath,
  ]);
  try {
    unlinkSync(listFile);
    for (const f of normalizedParts) unlinkSync(f);
  } catch {
    // cleanup
  }
  return concatOk && existsSync(outFinalPath) && statSync(outFinalPath).size >= MIN_SEGMENT_BYTES;
}

export async function finalizeSessionRecording(liveSessionId: string) {
  if (!ctxRef) return;
  if (!mongoose.Types.ObjectId.isValid(liveSessionId)) return;

  const claimed = await mongoRegistry.models.LiveSession.findOneAndUpdate(
    { _id: liveSessionId, recordingStatus: { $nin: ['processing', 'ready'] } },
    { recordingStatus: 'processing' },
    { new: true },
  )
    .populate('hostId', 'name username')
    .lean();
  if (!claimed) return;

  const session = claimed;
  const tenantId = String(session.tenantId);
  const logger = ctxRef.logger;
  const hostId = String((session.hostId as any)?._id || session.hostId);

  try {
    const rawPaths = await ffmpegBridge.stopTranscoding(liveSessionId, logger);
    const usable = rawPaths.filter((file) => existsSync(file) && statSync(file).size >= MIN_SEGMENT_BYTES);
    if (usable.length === 0) {
      logger.warn({ liveSessionId, rawPaths }, 'Recording too small or missing; skipping upload');
      await liveSessionRepository.updateById(liveSessionId, tenantId, {
        recordingStatus: 'none',
      } as any);
      ffmpegBridge.cleanupSessionFiles(liveSessionId);
      return;
    }

    const firstSegment = usable[0];
    if (!firstSegment) {
      ffmpegBridge.cleanupSessionFiles(liveSessionId);
      return;
    }

    const dir = path.dirname(firstSegment);
    const finalMp4Path = path.join(dir, `${liveSessionId}_final.mp4`);

    logger.info({ liveSessionId, segments: usable.length }, 'Performing fast remux for immediate playback');
    const remuxOk = await fastLocalRemux(usable, finalMp4Path);

    if (remuxOk && existsSync(finalMp4Path)) {
      const fileSize = statSync(finalMp4Path).size;
      const title = `${session.title} (Recording)`;
      const slug = `${slugifySegment(title, 'recording')}-${String(liveSessionId).slice(-8)}`;

      const video = await mongoRegistry.models.Video.create({
        title,
        slug,
        description: session.description || '',
        originalFilename: `session-${liveSessionId}.mp4`,
        originalStorageKey: 'pending',
        status: VideoStatus.UPLOADING,
        processingProgress: 0,
        fileSize,
        mimeType: 'video/mp4',
        visibility: VideoVisibility.UNLISTED,
        createdBy: hostId,
        tenantId,
        availableQualities: [],
      });

      const keys = buildStorageKeys(String(video._id));
      await ctxRef.storage.upload(keys.original, createReadStream(finalMp4Path), {
        contentType: 'video/mp4',
        contentLength: fileSize,
      });

      video.originalStorageKey = keys.original;
      video.status = VideoStatus.UPLOADED;
      await video.save();

      await liveSessionRepository.updateById(liveSessionId, tenantId, {
        recordingVideoId: video._id as any,
        recordingStatus: 'ready',
      } as any);

      // Trigger background HLS transcoding & thumbnail generation
      if (ctxRef.queue) {
        await enqueueVideoProcessing(ctxRef.queue, String(video._id));
        video.status = VideoStatus.QUEUED;
        await video.save();
      }

      liveSessionEventEmitter.emit(LiveSessionEvents.STATUS, {
        liveSessionId,
        status: 'ended',
      });

      try {
        unlinkSync(finalMp4Path);
      } catch {
        // cleanup
      }
      ffmpegBridge.cleanupSessionFiles(liveSessionId);
      logger.info({ liveSessionId, videoId: String(video._id) }, 'Session recording ready for immediate playback');
      return;
    }

    // Fallback: enqueue through background worker session recording queue
    const keys = buildLiveSessionRecordingKeys(liveSessionId);
    const segmentKeys: string[] = [];
    for (const [index, file] of usable.entries()) {
      const key = keys.segmentKey(index);
      const contentType = file.endsWith('.webm') ? 'video/webm' : 'video/mp4';
      await ctxRef.storage.upload(key, createReadStream(file), {
        contentType,
        contentLength: statSync(file).size,
      });
      segmentKeys.push(key);
    }

    ffmpegBridge.cleanupSessionFiles(liveSessionId);

    await enqueueSessionRecording(ctxRef.sessionRecordingQueue, {
      liveSessionId,
      tenantId,
      hostId,
      title: `${session.title} (Recording)`,
      description: session.description || '',
      segmentKeys,
    });

    logger.info({ liveSessionId, segments: segmentKeys.length }, 'Enqueued session recording job for worker');
  } catch (err) {
    logger.error(err, `Failed to finalize recording for session ${liveSessionId}`);
    await liveSessionRepository.updateById(liveSessionId, tenantId, {
      recordingStatus: 'failed',
    } as any);
    ffmpegBridge.cleanupSessionFiles(liveSessionId);
  }
}
