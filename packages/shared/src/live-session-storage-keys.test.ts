import { describe, expect, it } from 'vitest';
import { buildLiveSessionRecordingKeys } from './live-session-storage-keys.js';

describe('live session recording storage keys', () => {
  it('builds a safe MinIO prefix for ObjectId sessions', () => {
    const keys = buildLiveSessionRecordingKeys('66c9e8abc1234567890abcde');
    expect(keys.prefix).toBe('live-sessions/66c9e8abc1234567890abcde');
    expect(keys.segmentsPrefix).toBe('live-sessions/66c9e8abc1234567890abcde/segments');
    expect(keys.segmentKey(0)).toBe('live-sessions/66c9e8abc1234567890abcde/segments/part000.mp4');
    expect(keys.segmentKey(12)).toBe('live-sessions/66c9e8abc1234567890abcde/segments/part012.mp4');
  });

  it('rejects unsafe ids', () => {
    expect(() => buildLiveSessionRecordingKeys('../secret')).toThrow('Invalid live session id');
  });
});
