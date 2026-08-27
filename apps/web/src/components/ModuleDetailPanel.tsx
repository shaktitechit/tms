'use client';

import { formatDuration, seenProgress, sumDurations } from '@/lib/format';
import { videoSlugOf } from '@/lib/roles';
import { SeenProgressSummary } from '@/components/SeenProgressSummary';
import { VideoCard } from '@/components/VideoCard';
import {
  getErrorMessage,
  useGetModuleQuery,
  useListVideosQuery,
} from '@/store/api';

export function ModuleDetailPanel({
  moduleSlug,
  videosHref,
  videosRole = 'tenant',
}: {
  moduleSlug: string;
  videosHref: string;
  videosRole?: string;
}) {
  const { data, error, isLoading } = useGetModuleQuery(moduleSlug, {
    skip: !moduleSlug,
  });

  const module = data?.module;

  const {
    data: videosData,
    error: videosError,
    isLoading: videosLoading,
  } = useListVideosQuery(
    { role: videosRole, moduleId: module?.id },
    { skip: !module?.id },
  );

  const videos = videosData?.videos ?? [];

  if (error && !module) {
    return <p className="text-rose-600">{getErrorMessage(error, 'Failed to load module')}</p>;
  }

  if (isLoading || !module) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">/{module.slug}</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">{module.name}</h1>
        {!videosLoading ? (
          <SeenProgressSummary progress={seenProgress(videos)} className="mt-3 max-w-xs" />
        ) : null}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Videos</h2>
          <p className="mt-1 text-sm text-slate-500">
            {videosLoading
              ? 'Loading videos…'
              : videos.length === 0
                ? 'No videos in this module yet'
                : `${videos.length} ${videos.length === 1 ? 'video' : 'videos'} · ${formatDuration(sumDurations(videos))} total`}
          </p>
        </div>
        {videosError ? (
          <p className="text-rose-600">{getErrorMessage(videosError, 'Failed to load videos')}</p>
        ) : null}
        {videosLoading ? (
          <p className="text-slate-500">Loading videos…</p>
        ) : videos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-8 text-center text-slate-500 sm:p-10">
            No videos in this module yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                href={`${videosHref}/${videoSlugOf(video)}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
