'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ContentSeenStatus } from '@video/shared';
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { formatDuration } from '@/lib/format';
import type { LessonDto } from '@/lib/types';

export type CurriculumLesson = LessonDto & { locked: boolean };

export function LessonCurriculumSidebar({
  lessons,
  currentSlug,
  lessonDetailHref,
  moduleName,
  loading,
}: {
  lessons: CurriculumLesson[];
  currentSlug: string;
  lessonDetailHref: (lessonSlug: string) => string;
  moduleName?: string | null;
  loading?: boolean;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const completedCount = lessons.filter(
    (lesson) => lesson.seenStatus === ContentSeenStatus.COMPLETED,
  ).length;
  const total = lessons.length;
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  useEffect(() => {
    const current = listRef.current?.querySelector('[aria-current="page"]');
    current?.scrollIntoView({ block: 'nearest' });
  }, [currentSlug]);

  return (
    <aside className="flex min-h-0 flex-col rounded-2xl border border-blue-100 bg-white xl:max-h-[calc(100dvh-9rem)]">
      <div className="border-b border-blue-50 px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Course lessons</p>
        <h2 className="mt-1 truncate text-base font-semibold text-slate-900">
          {moduleName ?? 'Module'}
        </h2>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">Loading lessons…</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              {total === 0
                ? 'No lessons yet'
                : `${completedCount} of ${total} complete`}
            </p>
            {total > 0 ? (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-50">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {total === 0 && !loading ? (
        <p className="px-4 py-6 text-sm text-slate-500">Lessons will appear here.</p>
      ) : (
        <ol ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {lessons.map((lesson, index) => {
            const serial = lesson.serial ?? index + 1;
            const current = lesson.slug === currentSlug;
            const completed = lesson.seenStatus === ContentSeenStatus.COMPLETED;

            const body = (
              <>
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    completed
                      ? 'bg-emerald-100 text-emerald-800'
                      : lesson.locked
                        ? 'bg-slate-100 text-slate-400'
                        : current
                          ? 'bg-accent text-white'
                          : 'bg-blue-50 text-slate-700'
                  }`}
                >
                  {completed ? <CheckIcon /> : lesson.locked ? <LockIcon /> : serial}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-medium ${
                      lesson.locked
                        ? 'text-slate-500'
                        : current
                          ? 'text-accent'
                          : 'text-slate-900'
                    }`}
                  >
                    {lesson.name}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span className="tabular-nums">{formatDuration(lesson.duration)}</span>
                    {lesson.locked ? (
                      <span>Complete previous to unlock</span>
                    ) : (
                      <>
                        <span className="tabular-nums">{lesson.completedPercent ?? 0}%</span>
                        <SeenStatusBadge status={lesson.seenStatus} />
                      </>
                    )}
                  </span>
                </span>
              </>
            );

            if (lesson.locked) {
              return (
                <li key={lesson.id}>
                  <div
                    className={`flex cursor-not-allowed items-start gap-3 rounded-xl px-2.5 py-2.5 ${
                      current ? 'bg-slate-50 ring-1 ring-slate-200' : ''
                    }`}
                    aria-current={current ? 'page' : undefined}
                    aria-disabled
                    title="Complete the previous lesson to unlock"
                  >
                    {body}
                  </div>
                </li>
              );
            }

            return (
              <li key={lesson.id}>
                <Link
                  href={lessonDetailHref(lesson.slug)}
                  aria-current={current ? 'page' : undefined}
                  className={`flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition ${
                    current
                      ? 'bg-blue-50 ring-1 ring-accent/20'
                      : 'hover:bg-blue-50/70'
                  }`}
                >
                  {body}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.3a1 1 0 0 1-1.426.006L3.29 9.254A1 1 0 1 1 4.71 7.846l3.04 3.052 6.536-6.614a1 1 0 0 1 1.418.006Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M10 1.5A3.5 3.5 0 0 0 6.5 5v2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-.5V5A3.5 3.5 0 0 0 10 1.5ZM8 5a2 2 0 1 1 4 0v2H8V5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
