import type { Request, Response } from 'express';
import { ERROR_CODES } from '@video/shared';
import { notFound } from '../../http/errors.js';
import type { AppContext } from '../../types.js';

export type ByteRange = {
  start: number;
  end: number;
};

/**
 * Parse a single `bytes=` Range request. Returns null when absent or unsatisfiable.
 */
export function parseByteRange(header: string | undefined, size: number): ByteRange | null {
  if (!header || size <= 0) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) {
    return null;
  }

  const startRaw = match[1];
  const endRaw = match[2];
  if (!startRaw && !endRaw) {
    return null;
  }

  let start: number;
  let end: number;

  if (!startRaw) {
    // Suffix range: bytes=-N → last N bytes
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return null;
    }
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startRaw);
    end = endRaw ? Number(endRaw) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
      return null;
    }
    end = Math.min(end, size - 1);
  }

  if (start >= size) {
    return null;
  }

  return { start, end };
}

/**
 * Stream a stored object for inline media playback with HTTP Range support.
 * Browsers use this for `<audio>` / `<video>` seeking without downloading the whole file.
 */
export async function pipeSeekableMedia(
  ctx: AppContext,
  req: Request,
  res: Response,
  input: {
    storageKey: string;
    mimeType: string;
    filename: string;
    fileSize?: number;
  },
) {
  const exists = await ctx.storage.exists(input.storageKey);
  if (!exists) {
    throw notFound('File not found', ERROR_CODES.NOT_FOUND);
  }

  const metadata = await ctx.storage.getMetadata(input.storageKey);
  const total =
    metadata.contentLength && metadata.contentLength > 0
      ? metadata.contentLength
      : input.fileSize && input.fileSize > 0
        ? input.fileSize
        : 0;

  const contentType = metadata.contentType ?? input.mimeType;
  const safeName = input.filename.replace(/"/g, '');
  const range = parseByteRange(
    typeof req.headers.range === 'string' ? req.headers.range : undefined,
    total,
  );

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'private, max-age=86400');

  if (range && total > 0) {
    const { start, end } = range;
    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', String(chunkSize));
    const body = await ctx.storage.download(input.storageKey, {
      range: `bytes=${start}-${end}`,
    });
    body.pipe(res);
    return;
  }

  if (total > 0) {
    res.setHeader('Content-Length', String(total));
  }
  const body = await ctx.storage.download(input.storageKey);
  body.pipe(res);
}
