export interface AudioStorageKeys {
  original: string;
  hlsPrefix: string;
  hlsMaster: string;
  prefix: string;
}

function assertSafeId(audioId: string): string {
  if (!/^[a-fA-F0-9]{24}$/.test(audioId)) {
    throw new Error('Invalid audio id');
  }
  return audioId;
}

export function buildAudioStorageKeys(audioId: string, originalExt = ''): AudioStorageKeys {
  const id = assertSafeId(audioId);
  const prefix = `audios/${id}`;
  const ext = originalExt.startsWith('.') ? originalExt.toLowerCase() : originalExt ? `.${originalExt.toLowerCase()}` : '';
  return {
    prefix,
    original: `${prefix}/original/source${ext || '.bin'}`,
    hlsPrefix: `${prefix}/hls`,
    hlsMaster: `${prefix}/hls/master.m3u8`,
  };
}

export function audioHlsVariantPlaylistKey(audioId: string, quality: string): string {
  const keys = buildAudioStorageKeys(audioId);
  return `${keys.hlsPrefix}/${quality}/index.m3u8`;
}

export function resolveAudioHlsObjectKey(audioId: string, requestPath: string): string {
  const keys = buildAudioStorageKeys(audioId);
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
