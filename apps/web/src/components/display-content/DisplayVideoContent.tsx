'use client';

import { useEffect, useState } from 'react';
import { VideoStatus, VideoVisibility } from '@video/shared';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { LessonModal } from '@/components/LessonFormModal';
import { Field, inputClassName } from '@/components/portals';
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/Toaster';
import {
  VideoLibraryConfirmActions,
  VideoLibraryPicker,
} from '@/components/VideoLibraryPicker';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import { useLearnerPreview } from '@/lib/learner-preview';
import { canManageCurriculum } from '@/lib/roles';
import type { VideoDto } from '@/lib/types';
import { useReportVideoSeen } from '@/lib/useReportVideoSeen';
import {
  getErrorMessage,
  useDeleteVideoMutation,
  useGetVideoQuery,
  useGetVideoStatusQuery,
  useUpdateVideoMutation,
} from '@/store/api';
import { ContentFormActions } from '@/components/add-content/ContentFormActions';
import { ContentItemShell } from './ContentItemShell';
import type { ContentDragProps } from './types';

const terminalStatuses = new Set<string>([VideoStatus.READY, VideoStatus.FAILED]);

export function DisplayVideoContent({
  item: initialVideo,
  onReady,
  ...dragProps
}: {
  item: VideoDto;
  onReady?: () => void;
} & ContentDragProps) {
  const toast = useToast();
  const { user } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySelection, setLibrarySelection] = useState<VideoDto | null>(null);
  const [editTitle, setEditTitle] = useState(initialVideo.title);
  const [editDescription, setEditDescription] = useState(initialVideo.description);
  const [editVisibility, setEditVisibility] = useState(initialVideo.visibility);

  const shouldPoll = !terminalStatuses.has(initialVideo.status);

  const { data: status } = useGetVideoStatusQuery(
    { id: initialVideo.id, role: user?.role },
    {
      skip: !shouldPoll || !user,
      pollingInterval: shouldPoll ? 2000 : 0,
    },
  );

  const { data: videoResult } = useGetVideoQuery(
    { id: initialVideo.id, role: user?.role },
    {
      skip: !user || !status || status.status !== VideoStatus.READY,
    },
  );

  useEffect(() => {
    if (status?.status === VideoStatus.READY || status?.status === VideoStatus.FAILED) {
      onReady?.();
    }
  }, [status?.status, onReady]);

  const displayVideo: VideoDto =
    videoResult?.video ??
    (status && shouldPoll
      ? {
          ...initialVideo,
          status: status.status,
          processingProgress: status.progress,
          errorMessage: status.errorMessage,
        }
      : initialVideo);

  const reportSeen = useReportVideoSeen(displayVideo);
  const [updateVideo, { isLoading: updating }] = useUpdateVideoMutation();
  const [deleteVideo, { isLoading: deleting }] = useDeleteVideoMutation();
  const [replacing, setReplacing] = useState(false);
  const learnerPreview = useLearnerPreview();

  const canManageAsAdmin =
    canManageCurriculum(user) && user?.tenantId === displayVideo.tenantId;
  const canManage =
    !learnerPreview && !!user && (user.id === displayVideo.createdBy || canManageAsAdmin);
  const canDelete = !learnerPreview && Boolean(canManageAsAdmin);

  useEffect(() => {
    if (!editing) {
      return;
    }
    setEditTitle(displayVideo.title);
    setEditDescription(displayVideo.description);
    setEditVisibility(displayVideo.visibility);
  }, [editing, displayVideo.title, displayVideo.description, displayVideo.visibility]);

  async function onReplaceFromLibrary() {
    if (!user || !librarySelection || !displayVideo.lessonId) {
      return;
    }
    if (librarySelection.id === displayVideo.id) {
      setLibraryOpen(false);
      return;
    }
    setActionError(null);
    setReplacing(true);
    try {
      await updateVideo({
        id: displayVideo.id,
        role: user.role,
        body: { lessonId: null },
        invalidateLessonId: displayVideo.lessonId,
      }).unwrap();
      await updateVideo({
        id: librarySelection.id,
        role: user.role,
        body: {
          lessonId: displayVideo.lessonId,
          ...(displayVideo.moduleId ? { moduleId: displayVideo.moduleId } : {}),
        },
        invalidateLessonId: displayVideo.lessonId,
      }).unwrap();
      toast.success('Video replaced from library.');
      setLibraryOpen(false);
      setLibrarySelection(null);
      onReady?.();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not replace video'));
    } finally {
      setReplacing(false);
    }
  }

  async function onDelete() {
    if (!canDelete || !user) {
      return;
    }
    setActionError(null);
    try {
      await deleteVideo({
        id: displayVideo.id,
        role: user.role,
        lessonId: displayVideo.lessonId,
      }).unwrap();
      setConfirmDelete(false);
      toast.success('Video deleted.');
      onReady?.();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Delete failed'));
    }
  }

  async function onSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }
    setActionError(null);
    try {
      await updateVideo({
        id: displayVideo.id,
        role: user.role,
        body: {
          title: editTitle.trim(),
          description: editDescription.trim(),
          visibility: editVisibility,
        },
      }).unwrap();
      toast.success('Video updated.');
      setEditing(false);
      onReady?.();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Update failed'));
    }
  }

  const ready = displayVideo.status === VideoStatus.READY && Boolean(displayVideo.playbackUrl);
  const failed = displayVideo.status === VideoStatus.FAILED;

  return (
    <>
      <ContentItemShell
        kind="Video"
        title={displayVideo.title}
        subtitle={
          [
            displayVideo.description || null,
            typeof displayVideo.duration === 'number' && displayVideo.duration > 0
              ? `Duration · ${formatDuration(displayVideo.duration)}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || null
        }
        badge={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={displayVideo.status} />
            <SeenStatusBadge status={displayVideo.seenStatus} />
          </div>
        }
        {...dragProps}
      >
        {ready && displayVideo.playbackUrl ? (
          <VideoPlayer
            src={displayVideo.playbackUrl}
            poster={displayVideo.thumbnailUrl}
            onSeen={reportSeen}
          />
        ) : failed ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
            {displayVideo.errorMessage ?? 'Video processing failed.'}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-blue-50 bg-slate-50">
            {displayVideo.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayVideo.thumbnailUrl}
                alt=""
                className="aspect-video w-full object-cover opacity-60"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center text-slate-400">
                No preview
              </div>
            )}
            <div className="space-y-2 p-3">
              <div className="h-2 overflow-hidden rounded-full bg-blue-50">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.max(4, displayVideo.processingProgress ?? 0)}%` }}
                />
              </div>
              <p className="text-sm text-slate-500">
                Processing video… {displayVideo.processingProgress ?? 0}%
              </p>
            </div>
          </div>
        )}

        {displayVideo.errorMessage && !failed ? (
          <p className="text-sm text-rose-600">{displayVideo.errorMessage}</p>
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
            <VideoLibraryPicker
              lessonId={displayVideo.lessonId ?? ''}
              excludeVideoIds={[displayVideo.id]}
              selectedId={librarySelection?.id}
              onSelect={setLibrarySelection}
              busy={replacing}
            />
            <VideoLibraryConfirmActions
              selected={librarySelection}
              busy={replacing}
              confirmLabel="Replace video"
              onCancel={() => setLibraryOpen(false)}
              onConfirm={() => void onReplaceFromLibrary()}
            />
          </div>
        </LessonModal>
      ) : null}

      {editing ? (
        <LessonModal title="Edit video" onClose={() => setEditing(false)}>
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
            <Field label="Visibility">
              <select
                value={editVisibility}
                onChange={(event) =>
                  setEditVisibility(event.target.value as VideoVisibility)
                }
                className={inputClassName}
              >
                <option value={VideoVisibility.PUBLIC}>Public</option>
                <option value={VideoVisibility.UNLISTED}>Unlisted</option>
                <option value={VideoVisibility.PRIVATE}>Private</option>
              </select>
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
          title="Delete video"
          description={`Delete “${displayVideo.title}” and all stored files? This cannot be undone.`}
          confirming={deleting}
          error={actionError}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </>
  );
}
