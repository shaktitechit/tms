import { describe, expect, it } from 'vitest';
import { VideoQuality } from '@video/shared';
import { parseFfmpegProgress } from './command.js';
import { buildMasterPlaylist, type VariantResult } from './hls.js';

describe('parseFfmpegProgress', () => {
  it('parses FFmpeg out_time_ms (microseconds) into seconds', () => {
    expect(parseFfmpegProgress('out_time_ms=2500000')).toBe(2.5);
  });

  it('parses out_time_us into seconds', () => {
    expect(parseFfmpegProgress('out_time_us=2000000')).toBe(2);
  });

  it('ignores unrelated lines', () => {
    expect(parseFfmpegProgress('progress=continue')).toBeNull();
  });
});

describe('buildMasterPlaylist', () => {
  it('only includes generated variants', () => {
    const variants: VariantResult[] = [
      {
        quality: {
          name: VideoQuality.P360,
          height: 360,
          width: 640,
          maxrate: '800k',
          bufsize: '1600k',
          audioBitrate: '96k',
          bandwidth: 800000,
        },
        outputWidth: 640,
        outputHeight: 360,
        playlistRelativePath: '360p/index.m3u8',
      },
      {
        quality: {
          name: VideoQuality.P720,
          height: 720,
          width: 1280,
          maxrate: '2800k',
          bufsize: '5600k',
          audioBitrate: '128k',
          bandwidth: 2800000,
        },
        outputWidth: 1280,
        outputHeight: 720,
        playlistRelativePath: '720p/index.m3u8',
      },
    ];

    const playlist = buildMasterPlaylist(variants);
    expect(playlist).toContain('#EXTM3U');
    expect(playlist).toContain('RESOLUTION=640x360');
    expect(playlist).toContain('360p/index.m3u8');
    expect(playlist).toContain('720p/index.m3u8');
    expect(playlist).not.toContain('1080p');
  });
});
