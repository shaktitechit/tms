'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ContentSeenStatus, withSequentialLocks } from '@video/shared';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import {
  LessonForm,
  LessonModal,
  emptyLessonForm,
  type LessonFormState,
} from '@/components/LessonFormModal';
import {
  ModuleForm,
  ModuleModal,
  emptyModuleForm,
  type ModuleFormState,
} from '@/components/ModuleFormModal';
import { primaryButtonClassName } from '@/components/portals';
import { WorkspaceBackAnchor } from '@/components/portals/shared/WorkspaceBackLink';
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { useToast } from '@/components/Toaster';
import { useAuth } from '@/lib/auth';
import { formatDuration, formatHours, sumDurations } from '@/lib/format';
import { canManageCurriculum, isLearner } from '@/lib/roles';
import type { LessonDto } from '@/lib/types';
import {
  getErrorMessage,
  useCreateLessonMutation,
  useDeleteLessonMutation,
  useGetModuleQuery,
  useListLessonsQuery,
  useReorderLessonsMutation,
  useUpdateLessonMutation,
  useUpdateModuleMutation,
} from '@/store/api';

export function ModuleLessonsPanel({
  moduleSlug,
  lessonDetailHref,
  departmentHref,
}: {
  moduleSlug: string;
  lessonDetailHref: (lessonSlug: string) => string;
  departmentHref: string;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = canManageCurriculum(user);
  const learner = isLearner(user);
  const { data, error, isLoading, refetch } = useGetModuleQuery(moduleSlug, {
    skip: !moduleSlug,
  });

  const mod = data?.module;

  const {
    data: lessonsData,
    error: lessonsError,
    isLoading: lessonsLoading,
    refetch: refetchLessons,
  } = useListLessonsQuery({ moduleId: mod?.id }, { skip: !mod?.id });

  const [createLesson, { isLoading: creating }] = useCreateLessonMutation();
  const [updateLesson, { isLoading: updating }] = useUpdateLessonMutation();
  const [deleteLesson, { isLoading: deleting }] = useDeleteLessonMutation();
  const [reorderLessons, { isLoading: reordering }] = useReorderLessonsMutation();
  const [updateModule, { isLoading: updatingModule }] = useUpdateModuleMutation();

  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<LessonFormState>(emptyLessonForm);
  const [editingLesson, setEditingLesson] = useState<LessonDto | null>(null);
  const [editForm, setEditForm] = useState<LessonFormState>(emptyLessonForm);
  const [pendingDelete, setPendingDelete] = useState<LessonDto | null>(null);
  const [editingModule, setEditingModule] = useState(false);
  const [moduleForm, setModuleForm] = useState<ModuleFormState>(emptyModuleForm);

  const lessons = [...(lessonsData?.lessons ?? mod?.lessons ?? [])].sort(
    (a, b) => (a.serial ?? 0) - (b.serial ?? 0),
  );
  const displayLessons = withSequentialLocks(lessons, learner);
  const moduleOptions = mod ? [{ id: mod.id, name: mod.name }] : [];
  const departmentOptions = mod?.departmentId
    ? [{ id: mod.departmentId, name: mod.departmentName ?? 'Department' }]
    : [];

  function openCreateModal() {
    if (!mod) {
      return;
    }
    setCreateForm({
      ...emptyLessonForm,
      authorName: user?.name ?? '',
      authorEmail: user?.email ?? '',
      moduleId: mod.id,
    });
    setFormError(null);
    setCreateOpen(true);
  }

  function closeCreateModal() {
    setCreateOpen(false);
    setCreateForm(emptyLessonForm);
    setFormError(null);
  }

  function openEditModule() {
    if (!mod) {
      return;
    }
    setModuleForm({
      name: mod.name,
      description: mod.description,
      authorName: mod.authorName,
      authorEmail: mod.authorEmail,
      departmentId: mod.departmentId ?? '',
      thumbnail: null,
    });
    setFormError(null);
    setEditingModule(true);
  }

  function closeEditModule() {
    setEditingModule(false);
    setModuleForm(emptyModuleForm);
    setFormError(null);
  }

  async function onSaveModule(event: React.FormEvent) {
    event.preventDefault();
    if (!mod) {
      return;
    }
    setFormError(null);
    try {
      await updateModule({
        id: mod.id,
        body: {
          name: moduleForm.name,
          description: moduleForm.description,
          authorName: moduleForm.authorName,
          authorEmail: moduleForm.authorEmail,
          departmentId: mod.departmentId,
          thumbnail: moduleForm.thumbnail,
        },
      }).unwrap();
      closeEditModule();
      toast.success('Module updated.');
      await refetch();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not update module'));
    }
  }

  function openEditModal(lesson: LessonDto) {
    if (!mod) {
      return;
    }
    setEditingLesson(lesson);
    setEditForm({
      name: lesson.name,
      description: lesson.description,
      authorName: lesson.authorName,
      authorEmail: lesson.authorEmail,
      moduleId: mod.id,
      thumbnail: null,
    });
    setFormError(null);
  }

  function closeEditModal() {
    setEditingLesson(null);
    setEditForm(emptyLessonForm);
    setFormError(null);
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!mod) {
      return;
    }
    setFormError(null);
    try {
      const result = await createLesson({
        name: createForm.name,
        description: createForm.description,
        authorName: createForm.authorName,
        authorEmail: createForm.authorEmail,
        moduleId: mod.id,
        thumbnail: createForm.thumbnail,
      }).unwrap();
      closeCreateModal();
      toast.success(`Lesson “${result.lesson.name}” created.`);
      await refetchLessons();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not create lesson'));
    }
  }

  async function onSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!mod || !editingLesson) {
      return;
    }
    setFormError(null);
    try {
      await updateLesson({
        id: editingLesson.id,
        body: {
          name: editForm.name,
          description: editForm.description,
          authorName: editForm.authorName,
          authorEmail: editForm.authorEmail,
          moduleId: mod.id,
          thumbnail: editForm.thumbnail,
        },
      }).unwrap();
      closeEditModal();
      toast.success('Lesson updated.');
      await refetchLessons();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not update lesson'));
    }
  }

  async function moveLesson(index: number, direction: -1 | 1) {
    if (!mod || reordering) {
      return;
    }
    const target = index + direction;
    if (target < 0 || target >= lessons.length) {
      return;
    }
    const ids = lessons.map((lesson) => lesson.id);
    const current = ids[index];
    ids[index] = ids[target];
    ids[target] = current;
    try {
      await reorderLessons({ moduleId: mod.id, ids }).unwrap();
      await refetchLessons();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not reorder lessons'));
    }
  }

  async function onDelete() {
    if (!pendingDelete) {
      return;
    }
    const id = pendingDelete.id;
    setFormError(null);
    try {
      await deleteLesson(id).unwrap();
      setPendingDelete(null);
      if (editingLesson?.id === id) {
        closeEditModal();
      }
      toast.success('Lesson deleted.');
      await refetchLessons();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not delete lesson'));
    }
  }

  const completedCount = displayLessons.filter(
    (lesson) => lesson.seenStatus === ContentSeenStatus.COMPLETED,
  ).length;
  const continueLesson =
    displayLessons.find(
      (lesson) => !lesson.locked && lesson.seenStatus !== ContentSeenStatus.COMPLETED,
    ) ?? displayLessons.find((lesson) => !lesson.locked);
  const continueLabel =
    completedCount === 0
      ? 'Start course'
      : completedCount === displayLessons.length && displayLessons.length > 0
        ? 'Review course'
        : 'Continue';

  const back = (
    <WorkspaceBackAnchor
      href={departmentHref}
      label={mod?.departmentName ?? 'Department'}
    />
  );

  if (error && !mod) {
    return (
      <>
        {back}
        <p className="text-rose-600">{getErrorMessage(error, 'Failed to load module')}</p>
      </>
    );
  }

  if (isLoading || !mod) {
    return (
      <>
        {back}
        <p className="text-slate-500">Loading…</p>
      </>
    );
  }

  const totalDuration = formatHours(sumDurations(lessons));
  const progressPercent =
    displayLessons.length === 0
      ? 0
      : Math.round((completedCount / displayLessons.length) * 100);

  return (
    <>
      {back}
      <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start">
          <span className="h-36 w-full shrink-0 overflow-hidden rounded-xl bg-blue-50 sm:h-40 lg:h-44 lg:w-72">
            {mod.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mod.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-500">
              {mod.departmentName ? `Department · ${mod.departmentName}` : 'Module'}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">{mod.name}</h1>
            {mod.description ? (
              <p className="mt-2 max-w-2xl text-slate-500">{mod.description}</p>
            ) : null}
            <p className="mt-3 text-sm text-slate-500">
              {lessonsLoading
                ? 'Loading lessons…'
                : lessons.length === 0
                  ? 'No lessons yet'
                  : `${lessons.length} ${lessons.length === 1 ? 'lesson' : 'lessons'} · ${totalDuration} · ${completedCount} complete`}
            </p>
            {lessons.length > 0 ? (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-50">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            ) : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {continueLesson ? (
                <Link
                  href={lessonDetailHref(continueLesson.slug)}
                  className={`${primaryButtonClassName} sm:w-auto sm:px-6`}
                >
                  {continueLabel}
                  {continueLabel !== 'Review course' ? ` · ${continueLesson.name}` : ''}
                </Link>
              ) : null}
              {canManage ? (
                <>
                  <button
                    type="button"
                    onClick={openEditModule}
                    className="rounded-full border border-blue-100 bg-white px-5 py-2.5 font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                  >
                    Edit module
                  </button>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="rounded-full border border-blue-100 bg-white px-5 py-2.5 font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                  >
                    Add lesson
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Course lessons</h2>
          <p className="mt-1 text-sm text-slate-500">
            {lessonsLoading
              ? 'Loading lessons…'
              : lessons.length === 0
                ? 'No lessons in this module yet'
                : learner
                  ? 'Complete each lesson to unlock the next'
                  : 'Open a lesson to teach or review content'}
          </p>
        </div>
        {lessonsError && !createOpen && !editingLesson ? (
          <p className="text-rose-600">{getErrorMessage(lessonsError, 'Failed to load lessons')}</p>
        ) : null}
        {lessonsLoading ? (
          <p className="text-slate-500">Loading lessons…</p>
        ) : lessons.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-8 text-center text-slate-500 sm:p-10">
            {canManage ? 'No lessons yet. Click Add lesson to create one.' : 'No lessons in this module yet.'}
          </p>
        ) : (
          <ol className={`divide-y divide-blue-50 overflow-hidden rounded-2xl border border-blue-100 bg-white ${reordering ? 'opacity-70' : ''}`}>
            {displayLessons.map((lesson, index) => {
              const serial = lesson.serial ?? index + 1;
              const completed = lesson.seenStatus === ContentSeenStatus.COMPLETED;
              const isContinue = continueLesson?.id === lesson.id && !completed;

              const meta = (
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                  <span className="tabular-nums">{formatDuration(lesson.duration)}</span>
                  {lesson.locked ? (
                    <span>Complete the previous lesson to unlock</span>
                  ) : (
                    <>
                      <span className="tabular-nums">{lesson.completedPercent ?? 0}%</span>
                      <SeenStatusBadge status={lesson.seenStatus} />
                    </>
                  )}
                </span>
              );

              const thumb = (
                <span
                  className={`h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-lg ${
                    lesson.locked ? 'bg-slate-100' : 'bg-blue-50'
                  }`}
                >
                  {lesson.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={lesson.thumbnailUrl}
                      alt=""
                      className={`h-full w-full object-cover ${lesson.locked ? 'opacity-50' : ''}`}
                    />
                  ) : null}
                </span>
              );

              const marker = (
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    completed
                      ? 'bg-emerald-100 text-emerald-800'
                      : lesson.locked
                        ? 'bg-slate-100 text-slate-400'
                        : isContinue
                          ? 'bg-accent text-white'
                          : 'bg-blue-50 text-slate-700'
                  }`}
                >
                  {completed ? <CheckIcon /> : lesson.locked ? <LockIcon /> : serial}
                </span>
              );

              return (
                <li
                  key={lesson.id}
                  className={`flex items-stretch gap-2 px-3 py-3 sm:px-4 ${
                    lesson.locked ? 'bg-slate-50/70' : isContinue ? 'bg-blue-50/60' : ''
                  }`}
                >
                  {canManage ? (
                    <div className="flex flex-col justify-center">
                      <button
                        type="button"
                        aria-label="Move lesson up"
                        disabled={index === 0 || reordering}
                        onClick={() => void moveLesson(index, -1)}
                        className="text-slate-400 hover:text-accent disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label="Move lesson down"
                        disabled={index === lessons.length - 1 || reordering}
                        onClick={() => void moveLesson(index, 1)}
                        className="text-slate-400 hover:text-accent disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  ) : null}
                  {lesson.locked ? (
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {thumb}
                      {marker}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-medium text-slate-500">
                          {lesson.name}
                        </span>
                        {meta}
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={lessonDetailHref(lesson.slug)}
                      className="flex min-w-0 flex-1 items-center gap-3 hover:text-accent"
                    >
                      {thumb}
                      {marker}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                          {lesson.name}
                          {isContinue ? (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-accent">
                              Up next
                            </span>
                          ) : null}
                        </span>
                        {meta}
                      </span>
                    </Link>
                  )}
                  {canManage ? (
                    <div className="flex shrink-0 flex-col justify-center gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(lesson)}
                        className="text-sm text-slate-600 hover:text-accent"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => {
                          setFormError(null);
                          setPendingDelete(lesson);
                        }}
                        className="text-sm text-rose-500 hover:text-rose-400 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {canManage && editingModule && mod ? (
        <ModuleModal title="Edit module" onClose={closeEditModule}>
          <ModuleForm
            form={moduleForm}
            onChange={setModuleForm}
            onSubmit={(event) => void onSaveModule(event)}
            submitLabel={updatingModule ? 'Saving…' : 'Save changes'}
            submitting={updatingModule}
            onCancel={closeEditModule}
            thumbnailLabel="Replace thumbnail"
            existingThumbnailUrl={mod.thumbnailUrl}
            departments={departmentOptions}
            departmentLocked
            error={formError}
          />
        </ModuleModal>
      ) : null}

      {canManage && createOpen ? (
        <LessonModal title="Add lesson" onClose={closeCreateModal}>
          <LessonForm
            form={createForm}
            onChange={setCreateForm}
            onSubmit={(event) => void onCreate(event)}
            submitLabel={creating ? 'Creating…' : 'Create lesson'}
            submitting={creating}
            onCancel={closeCreateModal}
            modules={moduleOptions}
            moduleLocked
            error={formError}
          />
        </LessonModal>
      ) : null}

      {canManage && editingLesson ? (
        <LessonModal title="Edit lesson" onClose={closeEditModal}>
          <LessonForm
            form={editForm}
            onChange={setEditForm}
            onSubmit={(event) => void onSaveEdit(event)}
            submitLabel={updating ? 'Saving…' : 'Save changes'}
            submitting={updating}
            onCancel={closeEditModal}
            thumbnailLabel="Replace thumbnail"
            existingThumbnailUrl={editingLesson.thumbnailUrl}
            modules={moduleOptions}
            moduleLocked
            error={formError}
          />
        </LessonModal>
      ) : null}

      {canManage && pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete lesson"
          description={`Delete lesson “${pendingDelete.name}”?`}
          confirming={deleting}
          error={formError}
          onConfirm={() => void onDelete()}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
    </>
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
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className="h-3.5 w-3.5 shrink-0"
    >
      <path
        fillRule="evenodd"
        d="M10 1.5A3.5 3.5 0 0 0 6.5 5v2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-.5V5A3.5 3.5 0 0 0 10 1.5ZM8 5a2 2 0 1 1 4 0v2H8V5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
