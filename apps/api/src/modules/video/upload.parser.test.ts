import { describe, expect, it } from 'vitest';
import { VideoVisibility } from '@video/shared';
import { parseVisibility } from './upload.parser.js';

describe('parseVisibility', () => {
  it('accepts supported visibility values', () => {
    expect(parseVisibility('PRIVATE')).toBe(VideoVisibility.PRIVATE);
    expect(parseVisibility('UNLISTED')).toBe(VideoVisibility.UNLISTED);
    expect(parseVisibility('PUBLIC')).toBe(VideoVisibility.PUBLIC);
  });

  it('defaults invalid values to public', () => {
    expect(parseVisibility('secret')).toBe(VideoVisibility.PUBLIC);
    expect(parseVisibility(undefined)).toBe(VideoVisibility.PUBLIC);
  });
});
