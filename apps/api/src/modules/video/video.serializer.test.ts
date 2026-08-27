import { describe, expect, it } from 'vitest';
import { VideoStatus, VideoVisibility } from '@video/shared';
import mongoose from 'mongoose';
import type { VideoDocument } from '../../models/index.js';
import { serializeStatus, serializeVideo } from './video.serializer.js';

function makeVideo(overrides: Partial<VideoDocument> = {}): VideoDocument {
  return {
    _id: new mongoose.Types.ObjectId('66c9e8abc1234567890abcde'),
    title: 'Demo',
    slug: 'demo',
    description: 'A clip',
    originalFilename: 'demo.mp4',
    originalStorageKey: 'videos/66c9e8abc1234567890abcde/original/source.mp4',
    thumbnailStorageKey: 'videos/66c9e8abc1234567890abcde/thumbnail/thumbnail.jpg',
    hlsMasterPlaylistKey: 'videos/66c9e8abc1234567890abcde/hls/master.m3u8',
    status: VideoStatus.READY,
    processingProgress: 100,
    duration: 12,
    fileSize: 2048,
    mimeType: 'video/mp4',
    width: 1920,
    height: 1080,
    availableQualities: ['360p', '720p'],
    visibility: VideoVisibility.PUBLIC,
    createdBy: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(),
    errorMessage: undefined,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as VideoDocument;
}

describe('serializeVideo', () => {
  it('exposes playback URLs only when READY', () => {
    const ready = serializeVideo(makeVideo());
    expect(ready.id).toBe('66c9e8abc1234567890abcde');
    expect(ready.slug).toBe('demo');
    expect(ready.playbackUrl).toBe('/api/videos/66c9e8abc1234567890abcde/hls/master.m3u8');
    expect(ready.thumbnailUrl).toContain('/thumbnail');
    expect(ready.seenStatus).toBe('PENDING');

    const processing = serializeVideo(makeVideo({ status: VideoStatus.PROCESSING, processingProgress: 40 }));
    expect(processing.playbackUrl).toBeNull();
  });
});

describe('serializeStatus', () => {
  it('returns the polling payload', () => {
    const payload = serializeStatus(makeVideo({ status: VideoStatus.PROCESSING, processingProgress: 65 }));
    expect(payload).toMatchObject({
      id: '66c9e8abc1234567890abcde',
      status: VideoStatus.PROCESSING,
      progress: 65,
    });
  });
});
