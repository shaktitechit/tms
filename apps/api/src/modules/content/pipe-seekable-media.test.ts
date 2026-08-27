import { describe, expect, it } from 'vitest';
import { parseByteRange } from './pipe-seekable-media.js';

describe('parseByteRange', () => {
  it('parses open-ended and closed ranges', () => {
    expect(parseByteRange('bytes=0-1023', 5000)).toEqual({ start: 0, end: 1023 });
    expect(parseByteRange('bytes=100-', 5000)).toEqual({ start: 100, end: 4999 });
    expect(parseByteRange('bytes=-200', 5000)).toEqual({ start: 4800, end: 4999 });
  });

  it('returns null for missing or invalid ranges', () => {
    expect(parseByteRange(undefined, 5000)).toBeNull();
    expect(parseByteRange('bytes=9000-', 5000)).toBeNull();
    expect(parseByteRange('bytes=abc-def', 5000)).toBeNull();
  });
});
