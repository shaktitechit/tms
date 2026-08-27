import { describe, expect, it } from 'vitest';
import { qualitiesForSource, evenDimension } from './qualities.js';
import { VideoQuality } from './types.js';

describe('qualitiesForSource', () => {
  it('generates 360p through 1080p for 1080p sources', () => {
    const qualities = qualitiesForSource(1920, 1080).map((q) => q.name);
    expect(qualities).toEqual([
      VideoQuality.P360,
      VideoQuality.P480,
      VideoQuality.P720,
      VideoQuality.P1080,
    ]);
  });

  it('does not upscale 720p sources to 1080p', () => {
    const qualities = qualitiesForSource(1280, 720).map((q) => q.name);
    expect(qualities).toEqual([VideoQuality.P360, VideoQuality.P480, VideoQuality.P720]);
  });

  it('only generates 360p for 360p sources', () => {
    const qualities = qualitiesForSource(640, 360).map((q) => q.name);
    expect(qualities).toEqual([VideoQuality.P360]);
  });

  it('still produces a rendition when source is below 360p', () => {
    const qualities = qualitiesForSource(320, 240);
    expect(qualities).toHaveLength(1);
    expect(qualities[0]?.height).toBe(240);
  });
});

describe('evenDimension', () => {
  it('returns even numbers unchanged', () => {
    expect(evenDimension(1920)).toBe(1920);
  });

  it('rounds odd values down to even', () => {
    expect(evenDimension(641)).toBe(640);
  });
});
