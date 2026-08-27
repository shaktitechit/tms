'use client';

import Link from 'next/link';
import { useState } from 'react';
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
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { useToast } from '@/components/Toaster';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import { canManageCurriculum } from '@/lib/roles';
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
}: {
  moduleSlug: string;
  lessonDetailHref: (lessonSlug: string) => string;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = canManageCurriculum(user);
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

  if (error && !mod) {
    return <p className="text-rose-600">{getErrorMessage(error, 'Failed to load module')}</p>;
  }

  if (isLoading || !mod) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-sm text-slate-500">/{mod.slug}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">{mod.name}</h1>
          {mod.description ? (
            <p className="mt-2 max-w-2xl text-slate-500">{mod.description}</p>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
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
              className={`${primaryButtonClassName} sm:w-auto sm:px-6`}
            >
              Add lesson
            </button>
          </div>
        ) : null}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Lessons</h2>
          <p className="mt-1 text-sm text-slate-500">
            {lessonsLoading
              ? 'Loading lessons…'
              : lessons.length === 0
                ? 'No lessons in this module yet'
                : `${lessons.length} ${lessons.length === 1 ? 'lesson' : 'lessons'}`}
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
          <div className="overflow-x-auto rounded-2xl border border-blue-100 bg-white">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-blue-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Lesson</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Author</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className={reordering ? 'opacity-70' : undefined}>
                {lessons.map((lesson, index) => (
                  <tr key={lesson.id} className="border-t border-blue-50">
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-center font-medium tabular-nums text-slate-700">
                          {lesson.serial ?? index + 1}
                        </span>
                        {canManage ? (
                          <div className="flex flex-col">
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
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={lessonDetailHref(lesson.slug)}
                        className="flex items-center gap-3 hover:text-accent"
                      >
                        <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-blue-50">
                          {lesson.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={lesson.thumbnailUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-900">{lesson.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            /{lesson.slug}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {formatDuration(lesson.duration)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {lesson.completedPercent ?? 0}%
                    </td>
                    <td className="px-4 py-3">
                      <SeenStatusBadge status={lesson.seenStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{lesson.authorName}</p>
                      <p className="truncate text-xs text-slate-500">{lesson.authorEmail}</p>
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEditModal(lesson)}
                            className="text-slate-600 hover:text-accent"
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
                            className="text-rose-500 hover:text-rose-400 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : (
                      <td className="px-4 py-3" />
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  );
}
