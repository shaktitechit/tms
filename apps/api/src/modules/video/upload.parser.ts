import { PassThrough } from 'node:stream';
import Busboy from 'busboy';
import type { Request } from 'express';
import { AppError, ERROR_CODES, VideoVisibility, validateVideoFile } from '@video/shared';
import type { AppContext } from '../../types.js';

export interface ParsedUpload {
  title: string;
  description: string;
  visibility: VideoVisibility;
  moduleId?: string;
  lessonId?: string;
  filename: string;
  mimeType: string;
  size: number;
  stream: PassThrough;
}

export function parseVideoUpload(req: Request, ctx: AppContext): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('multipart/form-data')) {
      reject(new AppError('Content-Type must be multipart/form-data', ERROR_CODES.VALIDATION_ERROR, 400));
      return;
    }

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: ctx.env.VIDEO_MAX_SIZE,
        fields: 10,
      },
    });

    const fields: Record<string, string> = {};
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      req.unpipe(busboy);
      reject(error);
    };

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      if (name !== 'video' && name !== 'file') {
        file.resume();
        return;
      }

      const mimeType = info.mimeType || 'application/octet-stream';
      const validation = validateVideoFile(
        { filename: info.filename, mimeType },
        {
          allowedMimeTypes: ctx.env.ALLOWED_VIDEO_MIME_TYPES.split(',').map((item) => item.trim()),
          allowedExtensions: ctx.env.ALLOWED_VIDEO_EXTENSIONS.split(',').map((item) => item.trim()),
          maxSize: ctx.env.VIDEO_MAX_SIZE,
        },
      );

      if (!validation.ok) {
        file.resume();
        fail(
          new AppError(
            validation.message ?? 'Invalid video file',
            validation.code ?? ERROR_CODES.INVALID_FILE,
            validation.code === ERROR_CODES.FILE_TOO_LARGE ? 413 : 400,
          ),
        );
        return;
      }

      file.on('limit', () => {
        fail(
          new AppError(
            `File exceeds maximum size of ${ctx.env.VIDEO_MAX_SIZE} bytes`,
            ERROR_CODES.FILE_TOO_LARGE,
            413,
          ),
        );
      });

      const passthrough = new PassThrough();
      file.pipe(passthrough);
      file.on('error', fail);

      if (settled) {
        return;
      }
      settled = true;
      resolve({
        title: (fields.title ?? '').trim(),
        description: fields.description ?? '',
        visibility: parseVisibility(fields.visibility),
        moduleId: fields.moduleId?.trim() || undefined,
        lessonId: fields.lessonId?.trim() || undefined,
        filename: info.filename,
        mimeType,
        size: Number(req.headers['content-length'] ?? 0),
        stream: passthrough,
      });
    });

    busboy.on('filesLimit', () => {
      fail(new AppError('Only one video file can be uploaded', ERROR_CODES.VALIDATION_ERROR, 400));
    });

    busboy.on('error', fail);
    busboy.on('finish', () => {
      if (!settled) {
        fail(new AppError('Video file is required', ERROR_CODES.INVALID_FILE, 400));
      }
    });

    req.pipe(busboy);
  });
}

export function parseVisibility(value?: string): VideoVisibility {
  if (value === VideoVisibility.PRIVATE || value === VideoVisibility.UNLISTED || value === VideoVisibility.PUBLIC) {
    return value;
  }
  return VideoVisibility.PUBLIC;
}
