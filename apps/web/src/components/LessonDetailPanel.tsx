'use client';

import { useCallback, useState } from 'react';
import { LessonAddContentModal } from '@/components/add-content';
import { LessonContentList } from '@/components/display-content';
import { primaryButtonClassName } from '@/components/portals';
import { VideoDiscussion } from '@/components/VideoDiscussion';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import { LearnerPreviewProvider } from '@/lib/learner-preview';
import { canManageCurriculum } from '@/lib/roles';
import type { LessonDto } from '@/lib/types';
import { getErrorMessage, useGetLessonQuery } from '@/store/api';

export function LessonDetailPanel({
  lessonSlug,
}: {
  lessonSlug: string;
}) {
  const { data, error, isLoading, refetch } = useGetLessonQuery(lessonSlug, {
    skip: !lessonSlug,
  });
  const { user } = useAuth();
  const canManage = canManageCurriculum(user);
  const [addOpen, setAddOpen] = useState(false);
  const [learnerPreview, setLearnerPreview] = useState(false);

  const lesson = data?.lesson as LessonDto | undefined;
  const showManageUi = canManage && !learnerPreview;

  const onContentReady = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (error && !lesson) {
    return <p className="text-rose-600">{getErrorMessage(error, 'Failed to load lesson')}</p>;
  }

  if (isLoading || !lesson) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <LearnerPreviewProvider enabled={learnerPreview}>
      <div className="space-y-8">
        {canManage && learnerPreview ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-blue-50 px-4 py-3 text-sm text-slate-700">
            <p>
              <span className="font-medium text-accent">Learner preview</span>
              {' · '}You are seeing this lesson as a learner.
            </p>
            <button
              type="button"
              onClick={() => setLearnerPreview(false)}
              className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-white"
            >
              Exit preview
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
          <div>
            <p className="text-sm text-slate-500">/{lesson.slug}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
              {lesson.name}
            </h1>
            {lesson.moduleName ? (
              <p className="mt-2 text-sm text-slate-500">Module · {lesson.moduleName}</p>
            ) : null}
            {lesson.description ? (
              <p className="mt-2 max-w-2xl text-slate-500">{lesson.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
            <span className="inline-flex items-center justify-center self-end rounded-lg bg-slate-900 px-2.5 py-1 text-sm font-medium text-white">
              {formatDuration(lesson.duration)} · {lesson.completedPercent ?? 0}%
            </span>
            {canManage ? (
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <button
                  type="button"
                  role="switch"
                  aria-checked={learnerPreview}
                  aria-label="Learner preview"
                  onClick={() => {
                    setLearnerPreview((current) => {
                      const next = !current;
                      if (next) {
                        setAddOpen(false);
                      }
                      return next;
                    });
                  }}
                  className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition sm:w-auto ${
                    learnerPreview
                      ? 'border-accent bg-accent text-white hover:bg-accent-dim'
                      : 'border-blue-100 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  <span
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                      learnerPreview ? 'bg-white/30' : 'bg-slate-200'
                    }`}
                    aria-hidden
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                        learnerPreview ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                  Learner preview
                </button>
                {showManageUi ? (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    aria-label="Add content"
                    className={`${primaryButtonClassName} inline-flex items-center justify-center gap-2 sm:w-auto sm:px-5`}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      +
                    </span>
                    Add content
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <LessonContentList lesson={lesson} onContentReady={onContentReady} />

        <VideoDiscussion lessonId={lesson.id} />

        <section className="rounded-2xl border border-blue-100 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Author</h2>
          <div className="mt-3 text-sm">
            <p className="font-medium text-slate-800">{lesson.authorName}</p>
            <p className="truncate text-slate-500">{lesson.authorEmail}</p>
          </div>
        </section>

        {showManageUi && addOpen ? (
          <LessonAddContentModal
            lessonId={lesson.id}
            moduleId={lesson.moduleId}
            onClose={() => setAddOpen(false)}
            onCreated={() => {
              void refetch();
            }}
          />
        ) : null}
      </div>
    </LearnerPreviewProvider>
  );
}
