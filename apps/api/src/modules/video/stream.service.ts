import { extname } from 'node:path';
import type { Request, Response } from 'express';
import {
  AppError,
  ERROR_CODES,
  HLS_CONTENT_TYPES,
  VideoStatus,
  canWatchVideo,
  resolveHlsObjectKey,
} from '@video/shared';
import { forbidden, notFound } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { videoRepository } from './video.repository.js';

export class StreamService {
  constructor(private readonly ctx: AppContext) {}

  async authorize(videoId: string, user?: { id: string; role: string; tenantId?: string }) {
    const video = await videoRepository.findByRef(videoId, user?.tenantId);
    if (!video) {
      throw notFound('Video not found', ERROR_CODES.VIDEO_NOT_FOUND);
    }
    if (
      !canWatchVideo(
        video.visibility,
        String(video.createdBy),
        user,
        String(video.tenantId),
      )
    ) {
      throw forbidden('This video is private');
    }
    return video;
  }

  async streamInfo(videoId: string, user?: { id: string; role: string; tenantId?: string }) {
    const video = await this.authorize(videoId, user);
    if (video.status !== VideoStatus.READY || !video.hlsMasterPlaylistKey) {
      throw new AppError('Video is not ready for playback', ERROR_CODES.VIDEO_NOT_READY, 409);
    }

    const id = String(video._id);
    const playbackPath = `/api/videos/${id}/hls/master.m3u8`;
    const thumbnailPath = video.thumbnailStorageKey ? `/api/videos/${id}/thumbnail` : null;

    const signedMasterUrl =
      video.visibility === 'PRIVATE'
        ? await this.ctx.storage.getSignedUrl(video.hlsMasterPlaylistKey, 300)
        : undefined;

    return {
      id: videoId,
      playbackUrl: playbackPath,
      thumbnailUrl: thumbnailPath,
      signedMasterUrl,
      availableQualities: video.availableQualities,
      duration: video.duration ?? null,
    };
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
    res.setHeader('Cache-Control', extension === '.m3u8' ? 'private, max-age=30' : 'private, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');

    const body = await this.ctx.storage.download(key);
    body.pipe(res);
  }

  async pipeHls(req: Request, res: Response, videoId: string, assetPath: string): Promise<void> {
    await this.authorize(videoId, req.user);
    let key: string;
    try {
      key = resolveHlsObjectKey(videoId, assetPath);
    } catch {
      throw new AppError('Invalid stream path', ERROR_CODES.INVALID_PATH, 400);
    }
    await this.pipeObject(res, key, assetPath);
  }

  async pipeThumbnail(req: Request, res: Response, videoId: string): Promise<void> {
    const video = await this.authorize(videoId, req.user);
    if (!video.thumbnailStorageKey) {
      throw notFound('Thumbnail not found');
    }
    await this.pipeObject(res, video.thumbnailStorageKey, 'thumbnail.jpg');
  }
}
