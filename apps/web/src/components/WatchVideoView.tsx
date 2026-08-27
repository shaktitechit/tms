'use client';

import Link from 'next/link';
import { VideoStatus } from '@video/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { VideoDiscussion } from '@/components/VideoDiscussion';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useAuth } from '@/lib/auth';
import { useReportVideoSeen } from '@/lib/useReportVideoSeen';
import { getErrorMessage, useGetVideoQuery } from '@/store/api';

export function WatchVideoView({
  videoSlug,
  manageHref,
}: {
  videoSlug: string;
  manageHref: string;
}) {
  const { user } = useAuth();
  const { data, error, isLoading } = useGetVideoQuery(
    { id: videoSlug, role: user?.role },
    { skip: !videoSlug || !user },
  );
  const video = data?.video;
  const reportSeen = useReportVideoSeen(video);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-5 sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Video unavailable</h1>
        <p className="mt-2 text-rose-600">{getErrorMessage(error)}</p>
      </div>
    );
  }

  if (isLoading || !video) {
    return <p className="text-slate-500">Loading video…</p>;
  }

  if (video.status === VideoStatus.FAILED) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 rounded-2xl border border-rose-200 bg-white p-5 sm:p-8">
        <StatusBadge status={video.status} />
        <h1 className="text-2xl font-semibold text-slate-900">{video.title}</h1>
        <p className="text-rose-600">{video.errorMessage ?? 'Processing failed.'}</p>
        <Link href={manageHref} className="text-accent hover:underline">
          Open management page
        </Link>
      </div>
    );
  }

  if (video.status !== VideoStatus.READY || !video.playbackUrl) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 rounded-2xl border border-blue-100 bg-white p-5 sm:p-8">
        <StatusBadge status={video.status} />
        <h1 className="text-2xl font-semibold text-slate-900">{video.title}</h1>
        <p className="text-slate-500">
          This video is not ready yet. Processing is at {video.processingProgress}%.
        </p>
        <Link href={manageHref} className="text-accent hover:underline">
          Track processing
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href={manageHref} className="text-sm text-accent hover:underline">
          Manage
        </Link>
      </div>

      <VideoPlayer src={video.playbackUrl} poster={video.thumbnailUrl} onSeen={reportSeen} />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{video.title}</h1>
          <StatusBadge status={video.status} />
          <SeenStatusBadge status={video.seenStatus} />
        </div>
        <p className="text-slate-500">{video.description || 'No description provided.'}</p>
      </div>

      <VideoDiscussion videoId={video.id} />
    </div>
  );
}
