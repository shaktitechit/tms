import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from './constants.js';
import {
  buildStorageKeys,
  getExtension,
  resolveHlsObjectKey,
  sanitizeOriginalFilename,
} from './storage-keys.js';
import { validateVideoFile } from './validation.js';

describe('sanitizeOriginalFilename', () => {
  it('strips path components to prevent traversal', () => {
    expect(sanitizeOriginalFilename('../../etc/passwd.mp4')).toBe('passwd.mp4');
    expect(sanitizeOriginalFilename('C:\\\\Users\\\\me\\\\video.mov')).toBe('video.mov');
  });

  it('replaces unsafe characters', () => {
    expect(sanitizeOriginalFilename('my video (1).mp4')).toBe('my_video__1_.mp4');
  });
});

describe('buildStorageKeys', () => {
  const id = '66c9e8abc1234567890abcde';

  it('builds deterministic keys', () => {
    const keys = buildStorageKeys(id);
    expect(keys.original).toBe(`videos/${id}/original/source.mp4`);
    expect(keys.hlsMaster).toBe(`videos/${id}/hls/master.m3u8`);
    expect(keys.thumbnail).toBe(`videos/${id}/thumbnail/thumbnail.jpg`);
  });

  it('rejects non-object-id paths', () => {
    expect(() => buildStorageKeys('../hack')).toThrow();
  });
});

describe('resolveHlsObjectKey', () => {
  const id = '66c9e8abc1234567890abcde';

  it('resolves playlist and segment keys', () => {
    expect(resolveHlsObjectKey(id, 'master.m3u8')).toBe(`videos/${id}/hls/master.m3u8`);
    expect(resolveHlsObjectKey(id, '/360p/segment000.ts')).toBe(
      `videos/${id}/hls/360p/segment000.ts`,
    );
  });

  it('rejects path traversal', () => {
    expect(() => resolveHlsObjectKey(id, '../original/source.mp4')).toThrow();
    expect(() => resolveHlsObjectKey(id, '360p/../../original/source.mp4')).toThrow();
  });
});

describe('validateVideoFile', () => {
  it('accepts a valid mp4', () => {
    const result = validateVideoFile({
      filename: 'clip.mp4',
      mimeType: 'video/mp4',
      size: 1024,
    });
    expect(result.ok).toBe(true);
    expect(result.extension).toBe('.mp4');
  });

  it('rejects disallowed extensions', () => {
    const result = validateVideoFile({
      filename: 'notes.txt',
      mimeType: 'text/plain',
      size: 10,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(ERROR_CODES.UNSUPPORTED_MEDIA_TYPE);
  });

  it('rejects oversized files', () => {
    const result = validateVideoFile(
      { filename: 'clip.mp4', mimeType: 'video/mp4', size: 200 },
      { maxSize: 100 },
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe(ERROR_CODES.FILE_TOO_LARGE);
  });

  it('rejects mime/extension mismatch via mime allow-list', () => {
    const result = validateVideoFile({
      filename: 'clip.mp4',
      mimeType: 'application/octet-stream',
      size: 100,
    });
    expect(result.ok).toBe(false);
  });
});

describe('getExtension', () => {
  it('returns a lowercase extension', () => {
    expect(getExtension('Movie.MP4')).toBe('.mp4');
  });
});
