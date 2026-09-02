'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ContentSeenStatus, withSequentialLocks } from '@video/shared';
import { LessonAddContentModal } from '@/components/add-content';
import { LessonContentList } from '@/components/display-content';
import { LessonCurriculumSidebar } from '@/components/LessonCurriculumSidebar';
import { primaryButtonClassName } from '@/components/portals';
import { WorkspaceBackAnchor } from '@/components/portals/shared/WorkspaceBackLink';
import { useToast } from '@/components/Toaster';
import { VideoDiscussion } from '@/components/VideoDiscussion';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import { LearnerPreviewProvider } from '@/lib/learner-preview';
import { canManageCurriculum, isLearner } from '@/lib/roles';
import type { LessonDto } from '@/lib/types';
import {
  getErrorMessage,
  useGetLessonQuery,
  useGetModuleQuery,
  useListLessonsQuery,
} from '@/store/api';

function isForbiddenError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 403
  );
}

export function LessonDetailPanel({
  lessonSlug,
  moduleHref,
  moduleSlug,
  lessonDetailHref,
}: {
  lessonSlug: string;
  moduleHref?: string;
  moduleSlug?: string;
  lessonDetailHref?: (lessonSlug: string) => string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { data, error, isLoading, refetch } = useGetLessonQuery(lessonSlug, {
    skip: !lessonSlug,
  });
  const { user } = useAuth();
  const canManage = canManageCurriculum(user);
  const learner = isLearner(user);
  const [addOpen, setAddOpen] = useState(false);
  const [learnerPreview, setLearnerPreview] = useState(false);
  const [mobileCurriculumOpen, setMobileCurriculumOpen] = useState(false);

  const lesson = data?.lesson as LessonDto | undefined;
  const showManageUi = canManage && !learnerPreview;
  const gated = learner || learnerPreview;

  const { data: moduleData } = useGetModuleQuery(moduleSlug ?? '', {
    skip: !moduleSlug,
  });
  const moduleId = lesson?.moduleId ?? moduleData?.module.id;
  const {
    data: lessonsData,
    isLoading: lessonsLoading,
  } = useListLessonsQuery({ moduleId }, { skip: !moduleId });

  const rawLessons = useMemo(
    () =>
      [...(lessonsData?.lessons ?? moduleData?.module.lessons ?? [])].sort(
        (a, b) => (a.serial ?? 0) - (b.serial ?? 0),
      ),
    [lessonsData?.lessons, moduleData?.module.lessons],
  );

  const lessons = useMemo(() => {
    if (!lesson) {
      return rawLessons;
    }
    return rawLessons.map((item) =>
      item.id === lesson.id || item.slug === lesson.slug
        ? {
            ...item,
            seenStatus: lesson.seenStatus,
            completedPercent: lesson.completedPercent,
            duration: lesson.duration ?? item.duration,
          }
        : item,
    );
  }, [rawLessons, lesson]);

  const displayLessons = useMemo(
    () => withSequentialLocks(lessons, gated),
    [lessons, gated],
  );

  const currentIndex = displayLessons.findIndex((item) => item.slug === lessonSlug);
  const previousLesson =
    currentIndex > 0 ? displayLessons[currentIndex - 1] : undefined;
  const nextLesson =
    currentIndex >= 0 && currentIndex < displayLessons.length - 1
      ? displayLessons[currentIndex + 1]
      : undefined;
  const canGoPrevious = Boolean(previousLesson && !previousLesson.locked && lessonDetailHref);
  const canGoNext = Boolean(nextLesson && !nextLesson.locked && lessonDetailHref);
  const lessonComplete = lesson?.seenStatus === ContentSeenStatus.COMPLETED;
  const moduleName = lesson?.moduleName ?? moduleData?.module.name;

  const onContentReady = useCallback(() => {
    void refetch();
  }, [refetch]);

  const wasCompletedRef = useRef<boolean | null>(null);
  const advancedFromRef = useRef(new Set<string>());
  const nextLessonSlug = nextLesson?.slug;
  const nextLessonName = nextLesson?.name;
  const nextLessonLocked = nextLesson?.locked ?? true;
  const listReady = !lessonsLoading && displayLessons.length > 0;

  useEffect(() => {
    wasCompletedRef.current = null;
    setMobileCurriculumOpen(false);
    const main = document.querySelector('main');
    main?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [lessonSlug]);

  useEffect(() => {
    if (!lesson || lesson.slug !== lessonSlug) {
      return;
    }
    const completed = lesson.seenStatus === ContentSeenStatus.COMPLETED;
    if (wasCompletedRef.current === null) {
      wasCompletedRef.current = completed;
      return;
    }
    const justFinished = wasCompletedRef.current === false && completed;
    if (justFinished && !listReady) {
      return;
    }
    wasCompletedRef.current = completed;
    if (
      !justFinished ||
      !nextLessonSlug ||
      nextLessonLocked ||
      !lessonDetailHref ||
      !(learner || learnerPreview) ||
      advancedFromRef.current.has(lesson.id)
    ) {
      return;
    }
    advancedFromRef.current.add(lesson.id);
    const href = lessonDetailHref(nextLessonSlug);
    toast.success(`Lesson complete. Opening “${nextLessonName}”…`);
    const timer = window.setTimeout(() => {
      router.push(href);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    lesson,
    lessonSlug,
    listReady,
    nextLessonSlug,
    nextLessonName,
    nextLessonLocked,
    lessonDetailHref,
    learner,
    learnerPreview,
    router,
    toast,
  ]);

  const back = moduleHref ? (
    <WorkspaceBackAnchor href={moduleHref} label={moduleName ?? 'Module'} />
  ) : null;

  const curriculum =
    lessonDetailHref && (displayLessons.length > 0 || lessonsLoading) ? (
      <LessonCurriculumSidebar
        lessons={displayLessons}
        currentSlug={lessonSlug}
        lessonDetailHref={lessonDetailHref}
        moduleName={moduleName}
        loading={lessonsLoading && displayLessons.length === 0}
      />
    ) : null;

  function goTo(slug: string | undefined) {
    if (!slug || !lessonDetailHref) {
      return;
    }
    router.push(lessonDetailHref(slug));
  }

  const pager = lessonDetailHref && displayLessons.length > 0 ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3">
      <button
        type="button"
        disabled={!canGoPrevious}
        onClick={() => goTo(previousLesson?.slug)}
        className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Previous
      </button>
      <p className="text-sm tabular-nums text-slate-500">
        {currentIndex >= 0 ? currentIndex + 1 : '—'} / {displayLessons.length}
      </p>
      <button
        type="button"
        disabled={!canGoNext}
        onClick={() => goTo(nextLesson?.slug)}
        title={
          nextLesson?.locked ? 'Complete this lesson to unlock the next one' : undefined
        }
        className={`${primaryButtonClassName} w-auto px-5 disabled:cursor-not-allowed ${
          canGoNext ? '' : 'opacity-40'
        }`}
      >
        {nextLesson ? 'Next lesson →' : 'Last lesson'}
      </button>
    </div>
  ) : null;

  const previewBanner =
    canManage && learnerPreview ? (
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
    ) : null;

  const manageControls = canManage ? (
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
  ) : null;

  const addModal =
    showManageUi && addOpen && lesson ? (
      <LessonAddContentModal
        lessonId={lesson.id}
        moduleId={lesson.moduleId}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          void refetch();
        }}
      />
    ) : null;

  function wrap(main: ReactNode) {
    return (
      <LearnerPreviewProvider enabled={learnerPreview}>
        {back}
        {previewBanner}
        {curriculum ? (
          <button
            type="button"
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 xl:hidden"
            aria-expanded={mobileCurriculumOpen}
            onClick={() => setMobileCurriculumOpen((open) => !open)}
          >
            Lessons
            {displayLessons.length > 0 ? (
              <span className="tabular-nums text-slate-500">
                {currentIndex >= 0 ? currentIndex + 1 : 0}/{displayLessons.length}
              </span>
            ) : null}
          </button>
        ) : null}
        {curriculum && mobileCurriculumOpen ? (
          <div className="mb-6 xl:hidden">{curriculum}</div>
        ) : null}
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-6">{main}</div>
          {curriculum ? (
            <div className="hidden w-full shrink-0 xl:sticky xl:top-0 xl:block xl:w-80">
              {curriculum}
            </div>
          ) : null}
        </div>
        {addModal}
      </LearnerPreviewProvider>
    );
  }

  if (error && !lesson) {
    if (isForbiddenError(error)) {
      return wrap(
        <div className="rounded-2xl border border-blue-100 bg-white px-6 py-10 text-center sm:px-10">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-400">Locked</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Lesson locked</h1>
          <p className="mx-auto mt-2 max-w-md text-slate-500">
            {getErrorMessage(error, 'Complete the previous lesson to unlock this one.')}
          </p>
          {canGoPrevious ? (
            <button
              type="button"
              onClick={() => goTo(previousLesson?.slug)}
              className={`${primaryButtonClassName} mt-6 inline-flex sm:w-auto sm:px-6`}
            >
              Continue previous lesson
            </button>
          ) : moduleHref ? (
            <Link
              href={moduleHref}
              className={`${primaryButtonClassName} mt-6 inline-flex sm:w-auto sm:px-6`}
            >
              Back to lessons
            </Link>
          ) : null}
        </div>,
      );
    }
    return (
      <>
        {back}
        <p className="text-rose-600">{getErrorMessage(error, 'Failed to load lesson')}</p>
      </>
    );
  }

  if (isLoading || !lesson) {
    return wrap(<p className="text-slate-500">Loading…</p>);
  }

  return wrap(
    <>
      <div className="rounded-2xl border border-blue-100 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            {moduleName ? (
              <p className="text-sm text-slate-500">Module · {moduleName}</p>
            ) : null}
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
              {lesson.name}
            </h1>
            {lesson.description ? (
              <p className="mt-2 max-w-2xl text-slate-500">{lesson.description}</p>
            ) : null}
            <p className="mt-3 text-sm text-slate-500">
              {lesson.authorName}
              {lesson.authorEmail ? ` · ${lesson.authorEmail}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
            <span className="inline-flex items-center justify-center self-end rounded-lg bg-slate-900 px-2.5 py-1 text-sm font-medium text-white">
              {formatDuration(lesson.duration)} · {lesson.completedPercent ?? 0}%
            </span>
            {manageControls}
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-50">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${lesson.completedPercent ?? 0}%` }}
          />
        </div>
      </div>

      <LessonContentList lesson={lesson} onContentReady={onContentReady} />

      {lessonComplete && nextLesson && canGoNext ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="font-semibold text-emerald-900">Lesson complete</p>
            <p className="mt-1 text-sm text-emerald-800">
              Next up: {nextLesson.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => goTo(nextLesson.slug)}
            className={`${primaryButtonClassName} mt-3 sm:mt-0 sm:w-auto sm:px-6`}
          >
            Continue to next lesson
          </button>
        </div>
      ) : null}

      {lessonComplete && !nextLesson ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
          <p className="font-semibold text-emerald-900">Module complete</p>
          <p className="mt-1 text-sm text-emerald-800">
            You have finished every lesson in this module.
          </p>
          {moduleHref ? (
            <Link
              href={moduleHref}
              className={`${primaryButtonClassName} mt-4 inline-flex sm:w-auto sm:px-6`}
            >
              Back to module
            </Link>
          ) : null}
        </div>
      ) : null}

      {pager}

      <VideoDiscussion lessonId={lesson.id} />
    </>,
  );
}
