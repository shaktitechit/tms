'use client';

import { useEffect, useState } from 'react';
import { ContentSeenStatus } from '@video/shared';
import { ContentFormActions } from '@/components/add-content/ContentFormActions';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { LessonModal } from '@/components/LessonFormModal';
import { Field, inputClassName } from '@/components/portals';
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { useToast } from '@/components/Toaster';
import { formatDuration } from '@/lib/format';
import { useCanManageCurriculum } from '@/lib/learner-preview';
import type { ImageDto } from '@/lib/types';
import {
  getErrorMessage,
  useDeleteImageMutation,
  useMarkImageSeenMutation,
  useUpdateImageMutation,
} from '@/store/api';
import { ContentItemShell } from './ContentItemShell';
import type { ContentDragProps } from './types';

export function DisplayImageContent({
  item,
  ...dragProps
}: { item: ImageDto } & ContentDragProps) {
  const toast = useToast();
  const canManage = useCanManageCurriculum();
  const [markSeen, { isLoading: marking }] = useMarkImageSeenMutation();
  const [updateImage, { isLoading: updating }] = useUpdateImageMutation();
  const [deleteImage, { isLoading: deleting }] = useDeleteImageMutation();

  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDescription, setEditDescription] = useState(item.description);
  const [editDurationMinutes, setEditDurationMinutes] = useState(() => {
    if (typeof item.duration === 'number' && item.duration > 0) {
      return String(Math.round(item.duration / 60));
    }
    return '';
  });

  const seenStatus =
    item.seenStatus === ContentSeenStatus.COMPLETED
      ? ContentSeenStatus.COMPLETED
      : ContentSeenStatus.PENDING;
  const isCompleted = seenStatus === ContentSeenStatus.COMPLETED;

  const durationLabel =
    typeof item.duration === 'number' && item.duration > 0
      ? formatDuration(item.duration)
      : null;

  useEffect(() => {
    if (!editing) {
      return;
    }
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditDurationMinutes(
      typeof item.duration === 'number' && item.duration > 0
        ? String(Math.round(item.duration / 60))
        : '',
    );
  }, [editing, item.title, item.description, item.duration]);

  async function onMarkCompleted() {
    setError(null);
    try {
      await markSeen(item.id).unwrap();
      toast.success('Marked as completed.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not mark as completed'));
    }
  }

  async function onDelete() {
    setDeleteError(null);
    try {
      await deleteImage({ id: item.id, lessonId: item.lessonId }).unwrap();
      toast.success('Image deleted.');
      setConfirmDelete(false);
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Could not delete image'));
    }
  }

  async function onSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    let duration: number | null = null;
    if (editDurationMinutes.trim()) {
      const minutes = Number(editDurationMinutes);
      if (!Number.isFinite(minutes) || minutes < 0) {
        setError('Duration must be a non-negative number of minutes');
        return;
      }
      duration = Math.round(minutes * 60);
    }

    try {
      await updateImage({
        id: item.id,
        body: {
          title: editTitle.trim(),
          description: editDescription.trim(),
          duration,
        },
        invalidateLessonId: item.lessonId,
      }).unwrap();
      toast.success('Image updated.');
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update image'));
    }
  }

  return (
    <>
      <ContentItemShell
        kind="Image"
        title={item.title}
        subtitle={
          [
            item.description || item.originalFilename || null,
            durationLabel ? `Duration · ${durationLabel}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || null
        }
        badge={<SeenStatusBadge status={seenStatus} />}
        {...dragProps}
      >
        {item.fileUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.fileUrl}
            alt={item.title}
            className="max-h-80 w-full rounded-xl object-contain bg-slate-50"
          />
        ) : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {canManage ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setEditing(true);
                }}
                className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-200 hover:bg-blue-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmDelete(true);
                }}
                className="rounded-full border border-rose-100 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:border-rose-200 hover:bg-rose-50"
              >
                Delete
              </button>
            </>
          ) : null}
          {!isCompleted ? (
            <button
              type="button"
              disabled={marking}
              onClick={() => void onMarkCompleted()}
              className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-medium text-accent hover:border-accent/40 hover:bg-blue-50 disabled:opacity-50"
            >
              {marking ? 'Saving…' : 'Mark completed'}
            </button>
          ) : null}
        </div>
      </ContentItemShell>

      {editing ? (
        <LessonModal title="Edit image" onClose={() => setEditing(false)}>
          <form onSubmit={(event) => void onSaveEdit(event)} className="space-y-4">
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <Field label="Title">
              <input
                required
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className={`${inputClassName} min-h-24`}
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                type="number"
                min={0}
                step={1}
                value={editDurationMinutes}
                onChange={(event) => setEditDurationMinutes(event.target.value)}
                placeholder="e.g. 5"
                className={inputClassName}
              />
            </Field>
            <ContentFormActions
              submitLabel="Save changes"
              submitting={updating}
              onCancel={() => setEditing(false)}
            />
          </form>
        </LessonModal>
      ) : null}

      {confirmDelete ? (
        <ConfirmDeleteModal
          title="Delete image"
          description={`Delete “${item.title}” and the stored file? This cannot be undone.`}
          confirming={deleting}
          error={deleteError}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </>
  );
}
