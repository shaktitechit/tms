'use client';

import { useEffect, useState } from 'react';
import { AudioStatus, ContentSeenStatus } from '@video/shared';
import { ContentFormActions } from '@/components/add-content/ContentFormActions';
import {
  AudioLibraryPicker,
  LibraryConfirmActions,
} from '@/components/AudioLibraryPicker';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { LessonModal } from '@/components/LessonFormModal';
import { Field, inputClassName } from '@/components/portals';
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/Toaster';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import { useLearnerPreview } from '@/lib/learner-preview';
import { canManageCurriculum } from '@/lib/roles';
import type { AudioDto } from '@/lib/types';
import { useReportAudioSeen } from '@/lib/useReportAudioSeen';
import {
  getErrorMessage,
  useDeleteAudioMutation,
  useGetAudioQuery,
  useGetAudioStatusQuery,
  useUpdateAudioMutation,
} from '@/store/api';
import { ContentItemShell } from './ContentItemShell';
import type { ContentDragProps } from './types';

const terminalStatuses = new Set<string>([AudioStatus.READY, AudioStatus.FAILED]);

export function DisplayAudioContent({
  item: initialAudio,
  onReady,
  ...dragProps
}: {
  item: AudioDto;
  onReady?: () => void;
} & ContentDragProps) {
  const toast = useToast();
  const { user } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySelection, setLibrarySelection] = useState<AudioDto | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [editTitle, setEditTitle] = useState(initialAudio.title);
  const [editDescription, setEditDescription] = useState(initialAudio.description);

  const shouldPoll = !terminalStatuses.has(initialAudio.status);

  const { data: status } = useGetAudioStatusQuery(initialAudio.id, {
    skip: !shouldPoll,
    pollingInterval: shouldPoll ? 2000 : 0,
  });

  const { data: audioResult } = useGetAudioQuery(initialAudio.id, {
    skip: !status || status.status !== AudioStatus.READY,
  });

  useEffect(() => {
    if (status?.status === AudioStatus.READY || status?.status === AudioStatus.FAILED) {
      onReady?.();
    }
  }, [status?.status, onReady]);

  const audio: AudioDto =
    audioResult?.audio ??
    (status && shouldPoll
      ? {
          ...initialAudio,
          status: status.status,
          processingProgress: status.progress,
          errorMessage: status.errorMessage,
        }
      : initialAudio);

  const reportSeen = useReportAudioSeen(audio);
  const [updateAudio, { isLoading: updating }] = useUpdateAudioMutation();
  const [deleteAudio, { isLoading: deleting }] = useDeleteAudioMutation();
  const learnerPreview = useLearnerPreview();

  const canManageAsAdmin =
    canManageCurriculum(user) && user?.tenantId === audio.tenantId;
  const canManage =
    !learnerPreview && !!user && (user.id === audio.createdBy || canManageAsAdmin);
  const canDelete = !learnerPreview && Boolean(canManageAsAdmin);

  useEffect(() => {
    if (!editing) {
      return;
    }
    setEditTitle(audio.title);
    setEditDescription(audio.description);
  }, [editing, audio.title, audio.description]);

  async function onReplaceFromLibrary() {
    if (!librarySelection || !audio.lessonId) {
      return;
    }
    if (librarySelection.id === audio.id) {
      setLibraryOpen(false);
      return;
    }
    setActionError(null);
    setReplacing(true);
    try {
      await updateAudio({
        id: audio.id,
        body: { lessonId: null },
        invalidateLessonId: audio.lessonId,
      }).unwrap();
      await updateAudio({
        id: librarySelection.id,
        body: { lessonId: audio.lessonId },
        invalidateLessonId: audio.lessonId,
      }).unwrap();
      toast.success('Audio replaced from library.');
      setLibraryOpen(false);
      setLibrarySelection(null);
      onReady?.();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not replace audio'));
    } finally {
      setReplacing(false);
    }
  }

  async function onDelete() {
    if (!canDelete) {
      return;
    }
    setActionError(null);
    try {
      await deleteAudio({ id: audio.id, lessonId: audio.lessonId }).unwrap();
      setConfirmDelete(false);
      toast.success('Audio deleted.');
      onReady?.();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Delete failed'));
    }
  }

  async function onSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    try {
      await updateAudio({
        id: audio.id,
        body: {
          title: editTitle.trim(),
          description: editDescription.trim(),
        },
        invalidateLessonId: audio.lessonId,
      }).unwrap();
      toast.success('Audio updated.');
      setEditing(false);
      onReady?.();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Update failed'));
    }
  }

  const ready = audio.status === AudioStatus.READY && Boolean(audio.playbackUrl);
  const failed = audio.status === AudioStatus.FAILED;
  const durationLabel =
    typeof audio.duration === 'number' && audio.duration > 0
      ? formatDuration(audio.duration)
      : null;

  return (
    <>
      <ContentItemShell
        kind="Audio"
        title={audio.title}
        subtitle={
          [audio.description || audio.originalFilename || null, durationLabel ? `Duration · ${durationLabel}` : null]
            .filter(Boolean)
            .join(' · ') || null
        }
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={audio.status} />
            <SeenStatusBadge
              status={
                audio.seenStatus === ContentSeenStatus.COMPLETED
                  ? ContentSeenStatus.COMPLETED
                  : ContentSeenStatus.PENDING
              }
            />
          </div>
        }
        {...dragProps}
      >
        {ready && audio.playbackUrl ? (
          <AudioPlayer src={audio.playbackUrl} onSeen={reportSeen} />
        ) : null}

        {!ready && !failed ? (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-blue-50">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.max(4, audio.processingProgress ?? 0)}%` }}
              />
            </div>
            <p className="text-sm text-slate-500">
              Processing audio… {audio.processingProgress ?? 0}%
            </p>
          </div>
        ) : null}

        {failed ? (
          <p className="text-sm text-rose-600">
            {audio.errorMessage ?? 'Audio processing failed'}
          </p>
        ) : null}

        {actionError ? <p className="text-sm text-rose-600">{actionError}</p> : null}

        {canManage ? (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setLibraryOpen(true);
                setLibrarySelection(null);
              }}
              className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-200 hover:bg-blue-50"
            >
              Select from library
            </button>
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setEditing(true);
              }}
              className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-200 hover:bg-blue-50"
            >
              Edit
            </button>
            {canDelete ? (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setConfirmDelete(true);
                }}
                disabled={deleting}
                className="rounded-full border border-rose-100 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-50"
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </ContentItemShell>

      {libraryOpen ? (
        <LessonModal title="Select from library" onClose={() => setLibraryOpen(false)} fullScreen>
          <div className="mx-auto w-full max-w-3xl space-y-4">
            {actionError ? <p className="text-sm text-rose-600">{actionError}</p> : null}
            <AudioLibraryPicker
              lessonId={audio.lessonId ?? ''}
              excludeAudioIds={[audio.id]}
              selectedId={librarySelection?.id}
              onSelect={setLibrarySelection}
              busy={replacing}
            />
            <LibraryConfirmActions
              selected={librarySelection}
              busy={replacing}
              confirmLabel="Replace audio"
              onCancel={() => setLibraryOpen(false)}
              onConfirm={() => void onReplaceFromLibrary()}
            />
          </div>
        </LessonModal>
      ) : null}

      {editing ? (
        <LessonModal title="Edit audio" onClose={() => setEditing(false)}>
          <form onSubmit={(event) => void onSaveEdit(event)} className="space-y-4">
            {actionError ? <p className="text-sm text-rose-600">{actionError}</p> : null}
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
          title="Delete audio"
          description={`Delete “${audio.title}” and all stored files? This cannot be undone.`}
          confirming={deleting}
          error={actionError}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </>
  );
}
