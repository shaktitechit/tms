import { ContentSeenStatus } from '@video/shared';
import { describe, expect, it } from 'vitest';
import {
  contentSummaryFromItems,
  numericDuration,
  quizDurationSeconds,
} from './lesson-content-summary.js';

describe('lesson content summary', () => {
  it('treats missing or non-positive durations as zero', () => {
    expect(numericDuration(null)).toBe(0);
    expect(numericDuration(-4)).toBe(0);
    expect(numericDuration(12.5)).toBe(12.5);
  });

  it('sums quiz question timers and defaults missing ones to 30s', () => {
    expect(quizDurationSeconds([{ duration: 10 }, { duration: null }, { duration: 20 }])).toBe(60);
    expect(quizDurationSeconds([])).toBe(0);
  });

  it('marks a lesson completed only when every content item is completed', () => {
    expect(
      contentSummaryFromItems([
        { duration: 10, completed: true },
        { duration: 20, completed: true },
      ]),
    ).toEqual({
      duration: 30,
      contentCount: 2,
      completedPercent: 100,
      seenStatus: ContentSeenStatus.COMPLETED,
    });

    expect(
      contentSummaryFromItems([
        { duration: 10, completed: true },
        { duration: 20, completed: false },
      ]),
    ).toMatchObject({
      seenStatus: ContentSeenStatus.PENDING,
      completedPercent: 33,
    });

    expect(contentSummaryFromItems([]).seenStatus).toBe(ContentSeenStatus.PENDING);
    expect(contentSummaryFromItems([]).completedPercent).toBe(0);
  });
});
