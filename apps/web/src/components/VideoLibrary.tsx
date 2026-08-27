'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AudioCard } from '@/components/AudioCard';
import { VideoCard } from '@/components/VideoCard';
import { formatDuration, sumDurations } from '@/lib/format';
import { audioSlugOf, videoSlugOf } from '@/lib/roles';
import { getErrorMessage, useListAudiosQuery, useListVideosQuery } from '@/store/api';

const filters = ['ALL', 'PROCESSING', 'READY', 'FAILED'] as const;
export type LibraryTab = 'videos' | 'audios';

export function VideoLibrary({
  role,
  tab,
  videosBase,
  audiosBase,
  description,
}: {
  role: string;
  tab: LibraryTab;
  videosBase: string;
  audiosBase: string;
  description: string;
}) {
  const searchParams = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const [filter, setFilter] = useState<(typeof filters)[number]>('ALL');
  const status = filter === 'ALL' ? undefined : filter;

  const {
    data: videosData,
    error: videosError,
    isLoading: videosLoading,
  } = useListVideosQuery({ status, role }, { skip: tab !== 'videos' });

  const {
    data: audiosData,
    error: audiosError,
    isLoading: audiosLoading,
  } = useListAudiosQuery(undefined, { skip: tab !== 'audios' });

  const videos = useMemo(() => {
    const list = videosData?.videos ?? [];
    if (!q) {
      return list;
    }
    return list.filter(
      (video) =>
        video.title.toLowerCase().includes(q) ||
        video.description.toLowerCase().includes(q) ||
        video.originalFilename.toLowerCase().includes(q),
    );
  }, [videosData?.videos, q]);

  const audios = useMemo(() => {
    let list = audiosData?.audios ?? [];
    if (status) {
      list = list.filter((audio) => audio.status === status);
    }
    if (!q) {
      return list;
    }
    return list.filter(
      (audio) =>
        audio.title.toLowerCase().includes(q) ||
        audio.description.toLowerCase().includes(q) ||
        audio.originalFilename.toLowerCase().includes(q),
    );
  }, [audiosData?.audios, q, status]);

  const isLoading = tab === 'videos' ? videosLoading : audiosLoading;
  const error = tab === 'videos' ? videosError : audiosError;
  const items = tab === 'videos' ? videos : audios;
  const itemLabel =
    tab === 'videos'
      ? items.length === 1
        ? 'video'
        : 'videos'
      : items.length === 1
        ? 'audio'
        : 'audios';

  const search = searchParams.toString();
  const withQuery = (href: string) => (search ? `${href}?${search}` : href);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Library</h1>
        <p className="mt-1 text-slate-500">
          {description}
          {q ? (
            <span className="text-slate-700">
              {' '}
              · Showing results for “{searchParams.get('q')}”
            </span>
          ) : null}
        </p>
        {!isLoading && items.length > 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {items.length} {itemLabel} · {formatDuration(sumDurations(items))} total
          </p>
        ) : null}
      </div>

      <div className="flex gap-2 rounded-full border border-blue-100 bg-slate-50 p-1 sm:w-fit">
        <Link
          href={withQuery(videosBase)}
          className={`flex-1 rounded-full px-4 py-1.5 text-center text-sm font-medium transition sm:flex-none ${
            tab === 'videos' ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
          }`}
        >
          Videos
        </Link>
        <Link
          href={withQuery(audiosBase)}
          className={`flex-1 rounded-full px-4 py-1.5 text-center text-sm font-medium transition sm:flex-none ${
            tab === 'audios' ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
          }`}
        >
          Audios
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              filter === item
                ? 'bg-accent text-white'
                : 'bg-white text-slate-600 ring-1 ring-blue-100 hover:bg-blue-50'
            }`}
          >
            {item === 'ALL' ? 'All' : item.charAt(0) + item.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error ? <p className="text-rose-600">{getErrorMessage(error)}</p> : null}
      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-8 text-center text-slate-500 sm:p-10">
          No {tab === 'videos' ? 'videos' : 'audios'} match this filter.
        </p>
      ) : tab === 'videos' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} href={`${videosBase}/${videoSlugOf(video)}`} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {audios.map((audio) => (
            <AudioCard
              key={audio.id}
              audio={audio}
              href={`${audiosBase}/${audioSlugOf(audio)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
