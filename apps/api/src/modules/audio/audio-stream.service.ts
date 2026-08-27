import { extname } from 'node:path';
import type { Request, Response } from 'express';
import {
  AppError,
  AudioStatus,
  ERROR_CODES,
  HLS_CONTENT_TYPES,
  resolveAudioHlsObjectKey,
} from '@video/shared';
import { notFound } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { audioRepository } from './audio.repository.js';

export class AudioStreamService {
  constructor(private readonly ctx: AppContext) {}

  async requireReadyAudio(ref: string, tenantId: string) {
    const audio = await audioRepository.findByRef(ref, tenantId);
    if (!audio) {
      throw notFound('Audio not found', ERROR_CODES.NOT_FOUND);
    }
    if (audio.status !== AudioStatus.READY || !audio.hlsMasterPlaylistKey) {
      throw new AppError('Audio is not ready for playback', ERROR_CODES.VIDEO_NOT_READY, 409);
    }
    return audio;
  }

  async pipeObject(res: Response, key: string, filenameHint?: string): Promise<void> {
    const exists = await this.ctx.storage.exists(key);
    if (!exists) {
      throw notFound('Media not found');
    }

    const metadata = await this.ctx.storage.getMetadata(key);
    const extension = extname(filenameHint ?? key).toLowerCase();
    const contentType = HLS_CONTENT_TYPES[extension] ?? metadata.contentType ?? 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    if (metadata.contentLength) {
      res.setHeader('Content-Length', String(metadata.contentLength));
    }
    res.setHeader(
      'Cache-Control',
      extension === '.m3u8' ? 'private, max-age=30' : 'private, max-age=86400',
    );
    res.setHeader('Accept-Ranges', 'bytes');

    const body = await this.ctx.storage.download(key);
    body.pipe(res);
  }

  async pipeHls(
    req: Request,
    res: Response,
    audioId: string,
    assetPath: string,
    tenantId: string,
  ): Promise<void> {
    await this.requireReadyAudio(audioId, tenantId);
    let key: string;
    try {
      key = resolveAudioHlsObjectKey(audioId, assetPath);
    } catch {
      throw new AppError('Invalid stream path', ERROR_CODES.INVALID_PATH, 400);
    }
    await this.pipeObject(res, key, assetPath);
  }
}
