import { ContentSeenStatus } from './types.js';

/** True when any earlier lesson in the module is not completed. */
export function previousLessonsBlockAccess(
  previous: Array<{ seenStatus?: string | null }>,
): boolean {
  return previous.some((lesson) => lesson.seenStatus !== ContentSeenStatus.COMPLETED);
}

/** Learners must finish lesson N before opening lesson N+1. Managers are never gated. */
export function withSequentialLocks<T extends { seenStatus?: string | null }>(
  lessons: T[],
  gated: boolean,
): Array<T & { locked: boolean }> {
  return lessons.map((lesson, index) => ({
    ...lesson,
    locked: gated && previousLessonsBlockAccess(lessons.slice(0, index)),
  }));
}
