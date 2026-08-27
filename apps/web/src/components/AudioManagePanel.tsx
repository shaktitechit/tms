'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AudioStatus } from '@video/shared';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/Toaster';
import { formatDuration } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { isTenantAdmin } from '@/lib/roles';
import type { AudioDto } from '@/lib/types';
import { useReportAudioSeen } from '@/lib/useReportAudioSeen';
import {
  getErrorMessage,
  useDeleteAudioMutation,
  useGetAudioQuery,
  useGetAudioStatusQuery,
} from '@/store/api';

export function AudioManagePanel({ audioSlug }: { audioSlug: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    data: audioResult,
    error: audioError,
    isLoading,
    refetch: refetchAudio,
  } = useGetAudioQuery(audioSlug, { skip: !audioSlug });

  const audio = audioResult?.audio;
  const shouldPoll =
    !!audioSlug &&
    !!audio &&
    audio.status !== AudioStatus.READY &&
    audio.status !== AudioStatus.FAILED;

  const { data: status } = useGetAudioStatusQuery(audioSlug, {
    skip: !shouldPoll,
    pollingInterval: shouldPoll ? 2000 : 0,
  });

  const [deleteAudio, { isLoading: deleting }] = useDeleteAudioMutation();

  useEffect(() => {
    if (!status || !audioSlug) {
      return;
    }
    if (status.status === AudioStatus.READY || status.status === AudioStatus.FAILED) {
      void refetchAudio();
    }
  }, [status, audioSlug, refetchAudio]);

  const displayAudio: AudioDto | undefined = audio
    ? status && shouldPoll
      ? {
          ...audio,
          status: status.status,
          processingProgress: status.progress,
          errorMessage: status.errorMessage,
        }
      : audio
    : undefined;
  const reportSeen = useReportAudioSeen(displayAudio);

  function libraryHref() {
    if (!user) {
      return '/';
    }
    if (isTenantAdmin(user)) {
      return `/${user.tenantSlug}/audios`;
    }
    return `/${user.tenantSlug}/${user.username}/audios`;
  }

  async function onDelete() {
    if (!isTenantAdmin(user) || !displayAudio) {
      return;
    }
    setActionError(null);
    try {
      await deleteAudio({ id: displayAudio.id, lessonId: displayAudio.lessonId }).unwrap();
      setConfirmDelete(false);
      toast.success('Audio deleted.');
      router.push(libraryHref());
    } catch (err) {
      setActionError(getErrorMessage(err, 'Delete failed'));
    }
  }

  if (!user) {
    return <p className="text-slate-500">Sign in to manage this audio.</p>;
  }
  if (audioError && !displayAudio) {
    return <p className="text-rose-600">{getErrorMessage(audioError, 'Failed to load audio')}</p>;
  }
  if (isLoading || !displayAudio) {
    return <p className="text-slate-500">Loading…</p>;
  }

  const canDelete = isTenantAdmin(user) && user.tenantId === displayAudio.tenantId;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section>
        {displayAudio.status === AudioStatus.READY && displayAudio.playbackUrl ? (
          <div className="rounded-2xl border border-blue-100 bg-white p-5 sm:p-8">
            <AudioPlayer src={displayAudio.playbackUrl} onSeen={reportSeen} />
          </div>
        ) : displayAudio.status === AudioStatus.FAILED ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center sm:p-8">
            <p className="text-rose-600">
              {displayAudio.errorMessage ?? 'Audio processing failed.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white p-6 text-center sm:p-10">
            <p className="text-sm text-slate-500">
              Stream unavailable — processing is at {displayAudio.processingProgress}%.
            </p>
            <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-blue-50">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${Math.max(4, displayAudio.processingProgress ?? 0)}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{displayAudio.title}</h1>
          <StatusBadge status={displayAudio.status} />
          <SeenStatusBadge status={displayAudio.seenStatus} />
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-sm text-slate-600">
            {formatDuration(displayAudio.duration)}
          </span>
        </div>
        <p className="text-slate-500">{displayAudio.description || 'No description provided.'}</p>
        {displayAudio.lessonName ? (
          <p className="text-sm text-slate-500">Lesson · {displayAudio.lessonName}</p>
        ) : null}
      </div>

      {displayAudio.errorMessage && displayAudio.status !== AudioStatus.FAILED ? (
        <p className="text-rose-600">{displayAudio.errorMessage}</p>
      ) : null}
      {actionError ? <p className="text-rose-600">{actionError}</p> : null}

      {canDelete ? (
        <div className="flex flex-wrap gap-3 border-t border-blue-100 pt-4">
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
        </div>
      ) : null}

      {confirmDelete ? (
        <ConfirmDeleteModal
          title="Delete audio"
          description={`Delete “${displayAudio.title}” and all stored files? This cannot be undone.`}
          confirming={deleting}
          error={actionError}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </div>
  );
}
