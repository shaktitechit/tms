import { extname } from 'node:path';
import { PassThrough } from 'node:stream';
import Busboy from 'busboy';
import type { Request } from 'express';
import { AppError, ERROR_CODES } from '@video/shared';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export interface ParsedModuleImage {
  filename: string;
  mimeType: string;
  size: number;
  stream: PassThrough;
}

export interface ParsedModuleForm {
  name: string;
  description: string;
  authorName: string;
  authorEmail: string;
  departmentId?: string;
  thumbnail?: ParsedModuleImage;
}

export function parseModuleForm(req: Request): Promise<ParsedModuleForm> {
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
    let thumbnail: ParsedModuleImage | undefined;
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
        fail(new AppError('Module name is required', ERROR_CODES.VALIDATION_ERROR, 400));
        return;
      }

      const authorName = fields.authorName?.trim();
      if (!authorName) {
        fail(new AppError('Author name is required', ERROR_CODES.VALIDATION_ERROR, 400));
        return;
      }

      const authorEmail = fields.authorEmail?.trim().toLowerCase();
      if (!authorEmail || !authorEmail.includes('@')) {
        fail(new AppError('A valid author email is required', ERROR_CODES.VALIDATION_ERROR, 400));
        return;
      }

      resolve({
        name,
        description: fields.description?.trim() ?? '',
        authorName,
        authorEmail,
        departmentId: fields.departmentId?.trim() || undefined,
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
