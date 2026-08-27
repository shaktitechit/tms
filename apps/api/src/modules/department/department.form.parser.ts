import { extname } from 'node:path';
import { PassThrough } from 'node:stream';
import Busboy from 'busboy';
import type { Request } from 'express';
import { AppError, ERROR_CODES } from '@video/shared';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export interface ParsedDepartmentImage {
  filename: string;
  mimeType: string;
  size: number;
  stream: PassThrough;
}

export interface ParsedDepartmentForm {
  name: string;
  description: string;
  thumbnail?: ParsedDepartmentImage;
}

export function parseDepartmentForm(req: Request): Promise<ParsedDepartmentForm> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('multipart/form-data')) {
      reject(
        new AppError('Content-Type must be multipart/form-data', ERROR_CODES.VALIDATION_ERROR, 400),
      );
      return;
    }

    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: MAX_IMAGE_SIZE, fields: 10 },
    });

    const fields: Record<string, string> = {};
    let thumbnail: ParsedDepartmentImage | undefined;
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
      if (name !== 'thumbnail' && name !== 'file') {
        file.resume();
        return;
      }

      const mimeType = info.mimeType || 'application/octet-stream';
      const extension = extname(info.filename || '').toLowerCase();
      const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

      if (!IMAGE_MIME.has(mimeType) && !allowedExt.has(extension)) {
        file.resume();
        fail(new AppError('Thumbnail must be an image', ERROR_CODES.INVALID_FILE, 400));
        return;
      }

      const stream = new PassThrough();
      let size = 0;

      file.on('data', (chunk: Buffer) => {
        size += chunk.length;
        stream.write(chunk);
      });

      file.on('limit', () => {
        stream.destroy();
        fail(new AppError('Thumbnail is too large (max 5 MB)', ERROR_CODES.FILE_TOO_LARGE, 413));
      });

      file.on('end', () => {
        stream.end();
        thumbnail = {
          filename: info.filename,
          mimeType: IMAGE_MIME.has(mimeType) ? mimeType : 'image/jpeg',
          size,
          stream,
        };
      });
    });

    busboy.on('error', (error: Error) => fail(error));

    busboy.on('finish', () => {
      if (settled) {
        return;
      }
      settled = true;

      const name = fields.name?.trim();
      if (!name) {
        fail(new AppError('Department name is required', ERROR_CODES.VALIDATION_ERROR, 400));
        return;
      }

      resolve({
        name,
        description: fields.description?.trim() ?? '',
        thumbnail,
      });
    });

    req.pipe(busboy);
  });
}

export function thumbnailExtension(mimeType: string): string {
  if (mimeType === 'image/png') {
    return '.png';
  }
  if (mimeType === 'image/webp') {
    return '.webp';
  }
  if (mimeType === 'image/gif') {
    return '.gif';
  }
  return '.jpg';
}
