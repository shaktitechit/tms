import { describe, expect, it } from 'vitest';
import { buildAudioStorageKeys, resolveAudioHlsObjectKey } from './audio-storage-keys.js';

describe('audio storage keys', () => {
  const id = '66c9e8abc1234567890abcde';

  it('builds original and hls keys', () => {
    const keys = buildAudioStorageKeys(id, '.mp3');
    expect(keys.prefix).toBe(`audios/${id}`);
    expect(keys.original).toBe(`audios/${id}/original/source.mp3`);
    expect(keys.hlsMaster).toBe(`audios/${id}/hls/master.m3u8`);
  });

  it('resolves nested hls assets safely', () => {
    expect(resolveAudioHlsObjectKey(id, 'master.m3u8')).toBe(`audios/${id}/hls/master.m3u8`);
    expect(resolveAudioHlsObjectKey(id, '128k/segment000.ts')).toBe(
      `audios/${id}/hls/128k/segment000.ts`,
    );
    expect(() => resolveAudioHlsObjectKey(id, '../secret')).toThrow('Invalid HLS path');
  });
});
