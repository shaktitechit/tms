import { describe, expect, it } from 'vitest';
import {
  isYoutubePlaybackUrl,
  parseYoutubeVideoId,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
} from './youtube.js';

const ID = 'dQw4w9WgXcQ';

describe('parseYoutubeVideoId', () => {
  it('accepts a bare video id', () => {
    expect(parseYoutubeVideoId(ID)).toBe(ID);
  });

  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=12s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?t=30`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `www.youtube.com/watch?v=${ID}`,
  ])('parses %s', (input) => {
    expect(parseYoutubeVideoId(input)).toBe(ID);
  });

  it('rejects non-YouTube URLs and junk', () => {
    expect(parseYoutubeVideoId('')).toBeNull();
    expect(parseYoutubeVideoId('https://vimeo.com/123')).toBeNull();
    expect(parseYoutubeVideoId('not a url')).toBeNull();
    expect(parseYoutubeVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
  });
});

describe('youtube URLs', () => {
  it('builds embed and thumbnail URLs', () => {
    expect(youtubeEmbedUrl(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}`);
    expect(youtubeThumbnailUrl(ID)).toBe(`https://img.youtube.com/vi/${ID}/hqdefault.jpg`);
    expect(isYoutubePlaybackUrl(youtubeEmbedUrl(ID))).toBe(true);
    expect(isYoutubePlaybackUrl('/api/videos/x/hls/master.m3u8')).toBe(false);
  });
});
