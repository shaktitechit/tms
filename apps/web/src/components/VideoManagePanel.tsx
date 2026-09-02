'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { VideoStatus } from '@video/shared';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/Toaster';
import { VideoDiscussion } from '@/components/VideoDiscussion';
import { VideoPlayer } from '@/components/VideoPlayer';
import { formatDuration } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import {
  departmentDetailPath,
  departmentsPath,
  isTenantAdmin,
  memberLayer,
  moduleDetailPath,
} from '@/lib/roles';
import type { VideoDto } from '@/lib/types';
import { useReportVideoSeen } from '@/lib/useReportVideoSeen';
import {
  getErrorMessage,
  useDeleteVideoMutation,
  useGetVideoQuery,
  useGetVideoStatusQuery,
  useUpdateVideoMutation,
} from '@/store/api';

export function VideoManagePanel({
  videoSlug,
}: {
  videoSlug: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    data: videoResult,
    error: videoError,
    isLoading,
    refetch: refetchVideo,
  } = useGetVideoQuery({ id: videoSlug, role: user?.role }, { skip: !videoSlug || !user });

  const video = videoResult?.video;
  const shouldPoll =
    !!videoSlug &&
    !!video &&
    video.status !== VideoStatus.READY &&
    video.status !== VideoStatus.FAILED;

  const { data: status } = useGetVideoStatusQuery(
    { id: videoSlug, role: user?.role },
    {
      skip: !shouldPoll || !user,
      pollingInterval: shouldPoll ? 2000 : 0,
    },
  );

  const [updateVideo] = useUpdateVideoMutation();
  const [deleteVideo, { isLoading: deleting }] = useDeleteVideoMutation();

  useEffect(() => {
    if (!status || !videoSlug) {
      return;
    }
    if (status.status === VideoStatus.READY || status.status === VideoStatus.FAILED) {
      void refetchVideo();
    }
  }, [status, videoSlug, refetchVideo]);

  const displayVideo: VideoDto | undefined = video
    ? status && shouldPoll
      ? {
          ...video,
          status: status.status,
          processingProgress: status.progress,
          errorMessage: status.errorMessage,
        }
      : video
    : undefined;
  const reportSeen = useReportVideoSeen(displayVideo);

  function backHref(video: VideoDto) {
    if (!user) {
      return '/';
    }
    if (isTenantAdmin(user)) {
      if (video.departmentSlug && video.moduleSlug) {
        return `/${user.tenantSlug}/departments/${video.departmentSlug}/modules/${video.moduleSlug}`;
      }
      if (video.departmentSlug) {
        return `/${user.tenantSlug}/departments/${video.departmentSlug}`;
      }
      return `/${user.tenantSlug}/departments`;
    }
    const username = user.username;
    const layer = memberLayer(user);
    if (video.departmentSlug && video.moduleSlug) {
      return moduleDetailPath(
        user.tenantSlug,
        video.departmentSlug,
        video.moduleSlug,
        username,
        layer,
      );
    }
    if (video.departmentSlug) {
      return departmentDetailPath(user.tenantSlug, video.departmentSlug, username, layer);
    }
    return departmentsPath(user.tenantSlug, username, layer);
  }

  async function onDelete() {
    if (!isTenantAdmin(user) || !displayVideo) {
      return;
    }
    setActionError(null);
    try {
      await deleteVideo({ id: displayVideo.id, role: user?.role }).unwrap();
      setConfirmDelete(false);
      toast.success('Video deleted.');
      router.push(backHref(displayVideo));
    } catch (err) {
      setActionError(getErrorMessage(err, 'Delete failed'));
    }
  }

  async function onVisibility(visibility: VideoDto['visibility']) {
    if (!displayVideo) {
      return;
    }
    setActionError(null);
    try {
      await updateVideo({
        id: displayVideo.id,
        body: { visibility },
        role: user?.role,
      }).unwrap();
      toast.success('Visibility updated.');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Update failed'));
    }
  }

  if (!user) {
    return <p className="text-slate-500">Sign in to manage this video.</p>;
  }
  if (videoError && !displayVideo) {
    return <p className="text-rose-600">{getErrorMessage(videoError, 'Failed to load video')}</p>;
  }
  if (isLoading || !displayVideo) {
    return <p className="text-slate-500">Loading…</p>;
  }

  const canManage =
    user.id === displayVideo.createdBy ||
    (user.role === 'tenant' && user.tenantId === displayVideo.tenantId);
  const canDelete = isTenantAdmin(user) && user.tenantId === displayVideo.tenantId;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section>
        {displayVideo.status === VideoStatus.READY && displayVideo.playbackUrl ? (
          <VideoPlayer
            src={displayVideo.playbackUrl}
            poster={displayVideo.thumbnailUrl}
            onSeen={reportSeen}
          />
        ) : displayVideo.status === VideoStatus.FAILED ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center sm:p-8">
            <p className="text-rose-600">
              {displayVideo.errorMessage ?? 'Video processing failed.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
            {displayVideo.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayVideo.thumbnailUrl}
                alt=""
                className="aspect-video w-full object-cover opacity-60"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-blue-50 text-slate-400">
                No preview
              </div>
            )}
            <p className="p-4 text-center text-sm text-slate-500">
              Stream unavailable — processing is at {displayVideo.processingProgress}%.
            </p>
          </div>
        )}
      </section>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{displayVideo.title}</h1>
          <StatusBadge status={displayVideo.status} />
          <SeenStatusBadge status={displayVideo.seenStatus} />
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-sm text-slate-600">
            {formatDuration(displayVideo.duration)}
          </span>
        </div>
        <p className="text-slate-500">{displayVideo.description || 'No description provided.'}</p>
      </div>

      {displayVideo.errorMessage && displayVideo.status !== VideoStatus.FAILED ? (
        <p className="text-rose-600">{displayVideo.errorMessage}</p>
      ) : null}
      {actionError ? <p className="text-rose-600">{actionError}</p> : null}

      {canManage ? (
        <div className="flex flex-wrap gap-3 border-t border-blue-100 pt-4">
          <select
            value={displayVideo.visibility}
            onChange={(event) =>
              void onVisibility(event.target.value as VideoDto['visibility'])
            }
            className="w-full rounded-full border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700 sm:w-auto"
          >
            <option value="PUBLIC">Public</option>
            <option value="UNLISTED">Unlisted</option>
            <option value="PRIVATE">Private</option>
          </select>
          {canDelete ? (
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setConfirmDelete(true);
              }}
              disabled={deleting}
              className="rounded-full border border-rose-200 px-4 py-2 text-rose-600 disabled:opacity-50"
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}

      <VideoDiscussion videoId={displayVideo.id} />

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
    </div>
  );
}
