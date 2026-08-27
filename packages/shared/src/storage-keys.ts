export interface VideoStorageKeys {
  original: string;
  hlsPrefix: string;
  hlsMaster: string;
  thumbnail: string;
  prefix: string;
}

function assertSafeId(videoId: string): string {
  if (!/^[a-fA-F0-9]{24}$/.test(videoId)) {
    throw new Error('Invalid video id');
  }
  return videoId;
}

export function buildStorageKeys(videoId: string): VideoStorageKeys {
  const id = assertSafeId(videoId);
  const prefix = `videos/${id}`;
  return {
    prefix,
    original: `${prefix}/original/source.mp4`,
    hlsPrefix: `${prefix}/hls`,
    hlsMaster: `${prefix}/hls/master.m3u8`,
    thumbnail: `${prefix}/thumbnail/thumbnail.jpg`,
  };
}

export function hlsVariantPlaylistKey(videoId: string, quality: string): string {
  const keys = buildStorageKeys(videoId);
  return `${keys.hlsPrefix}/${quality}/index.m3u8`;
}

export function resolveHlsObjectKey(videoId: string, requestPath: string): string {
  const keys = buildStorageKeys(videoId);
  const trimmed = requestPath.replace(/^\/+/, '');
  const segments = trimmed.split('/').filter((segment) => segment.length > 0);

  if (segments.length === 0 || segments.some((segment) => segment === '..' || segment === '.')) {
    throw new Error('Invalid HLS path');
  }

  const key = `${keys.hlsPrefix}/${segments.join('/')}`;
  if (!key.startsWith(`${keys.hlsPrefix}/`)) {
    throw new Error('Invalid HLS path');
  }
  return key;
}

export function sanitizeOriginalFilename(originalName: string): string {
  const withoutPath = originalName.replace(/\\/g, '/').split('/').pop() ?? 'video';
  const sanitized = withoutPath.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
  return sanitized.length > 0 ? sanitized : 'video';
}

export function getExtension(filename: string): string {
  const sanitized = sanitizeOriginalFilename(filename);
  const index = sanitized.lastIndexOf('.');
  if (index <= 0) {
    return '';
  }
  return sanitized.slice(index).toLowerCase();
}
