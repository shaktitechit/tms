import { describe, expect, it } from 'vitest';
import { ContentSeenStatus } from './types.js';
import { previousLessonsBlockAccess, withSequentialLocks } from './lesson-progress.js';

const pending = { seenStatus: ContentSeenStatus.PENDING };
const completed = { seenStatus: ContentSeenStatus.COMPLETED };

describe('previousLessonsBlockAccess', () => {
  it('allows the first lesson', () => {
    expect(previousLessonsBlockAccess([])).toBe(false);
  });

  it('blocks when any previous lesson is still pending', () => {
    expect(previousLessonsBlockAccess([completed, pending])).toBe(true);
    expect(previousLessonsBlockAccess([pending])).toBe(true);
  });

  it('allows when every previous lesson is completed', () => {
    expect(previousLessonsBlockAccess([completed, completed])).toBe(false);
  });
});

describe('withSequentialLocks', () => {
  it('never locks lessons when the viewer is not gated', () => {
    expect(withSequentialLocks([pending, pending], false).map((row) => row.locked)).toEqual([
      false,
      false,
    ]);
  });

  it('unlocks each next lesson only after the previous one is completed', () => {
    const rows = withSequentialLocks([completed, pending, pending], true);
    expect(rows.map((row) => row.locked)).toEqual([false, false, true]);
  });

  it('keeps later lessons locked when an earlier one is still pending', () => {
    const rows = withSequentialLocks([pending, completed, completed], true);
    expect(rows.map((row) => row.locked)).toEqual([false, true, true]);
  });
});
