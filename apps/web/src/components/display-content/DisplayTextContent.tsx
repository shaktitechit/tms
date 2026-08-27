'use client';

import { useState } from 'react';
import { ContentSeenStatus } from '@video/shared';
import { TextContentForm } from '@/components/add-content/TextContentForm';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { LessonModal } from '@/components/LessonFormModal';
import { RichTextViewer } from '@/components/RichTextEditor';
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { useToast } from '@/components/Toaster';
import { formatDuration } from '@/lib/format';
import { useCanManageCurriculum } from '@/lib/learner-preview';
import type { TextAreaDto } from '@/lib/types';
import {
  getErrorMessage,
  useDeleteTextAreaMutation,
  useMarkTextAreaSeenMutation,
  useUpdateTextAreaMutation,
} from '@/store/api';
import { ContentItemShell } from './ContentItemShell';
import type { ContentDragProps } from './types';

export function DisplayTextContent({
  item,
  ...dragProps
}: { item: TextAreaDto } & ContentDragProps) {
  const toast = useToast();
  const canManage = useCanManageCurriculum();
  const [markSeen, { isLoading: marking }] = useMarkTextAreaSeenMutation();
  const [updateTextArea, { isLoading: updating }] = useUpdateTextAreaMutation();
  const [deleteTextArea, { isLoading: deleting }] = useDeleteTextAreaMutation();

  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const seenStatus =
    item.seenStatus === ContentSeenStatus.COMPLETED
      ? ContentSeenStatus.COMPLETED
      : ContentSeenStatus.PENDING;
  const isCompleted = seenStatus === ContentSeenStatus.COMPLETED;

  const durationLabel =
    typeof item.duration === 'number' && item.duration > 0
      ? formatDuration(item.duration)
      : null;

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
      await deleteTextArea({ id: item.id, lessonId: item.lessonId }).unwrap();
      toast.success('Text content deleted.');
      setConfirmDelete(false);
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Could not delete text content'));
    }
  }

  return (
    <>
      <ContentItemShell
        kind="Text"
        title={item.title}
        subtitle={
          [item.description || null, durationLabel ? `Duration · ${durationLabel}` : null]
            .filter(Boolean)
            .join(' · ') || null
        }
        badge={<SeenStatusBadge status={seenStatus} />}
        {...dragProps}
      >
        {item.body ? <RichTextViewer html={item.body} /> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {canManage ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
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
        <LessonModal title="Edit text" onClose={() => setEditing(false)} fullScreen>
          <div className="mx-auto w-full max-w-3xl">
            <TextContentForm
              key={item.id}
              initial={{
                title: item.title,
                description: item.description,
                body: item.body,
                duration: item.duration,
              }}
              submitLabel="Save changes"
              submitting={updating}
              onCancel={() => setEditing(false)}
              onSubmit={async (values) => {
                try {
                  await updateTextArea({
                    id: item.id,
                    body: {
                      title: values.title,
                      description: values.description,
                      body: values.body,
                      duration: values.duration,
                    },
                  }).unwrap();
                  toast.success('Text content updated.');
                  setEditing(false);
                } catch (err) {
                  throw new Error(getErrorMessage(err, 'Could not update text content'));
                }
              }}
            />
          </div>
        </LessonModal>
      ) : null}

      {confirmDelete ? (
        <ConfirmDeleteModal
          title="Delete text content?"
          description={`Delete “${item.title}”? This cannot be undone.`}
          confirming={deleting}
          error={deleteError}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </>
  );
}
