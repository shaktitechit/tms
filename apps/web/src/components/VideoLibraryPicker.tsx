'use client';

import { useMemo, useState } from 'react';
import { VideoStatus } from '@video/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { inputClassName, primaryButtonClassName } from '@/components/portals';
import { useAuth } from '@/lib/auth';
import { formatDuration } from '@/lib/format';
import type { VideoDto } from '@/lib/types';
import { getErrorMessage, useListVideosQuery } from '@/store/api';

export function VideoLibraryPicker({
  lessonId,
  excludeVideoIds = [],
  selectedId,
  onSelect,
  busy = false,
}: {
  lessonId: string;
  excludeVideoIds?: string[];
  selectedId?: string | null;
  onSelect: (video: VideoDto) => void;
  busy?: boolean;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const { data, error, isLoading } = useListVideosQuery(
    { role: user?.role },
    { skip: !user },
  );

  const excluded = useMemo(() => new Set(excludeVideoIds), [excludeVideoIds]);

  const videos = useMemo(() => {
    const list = data?.videos ?? [];
    const needle = query.trim().toLowerCase();
    return list
      .filter((video) => {
        if (excluded.has(video.id)) {
          return false;
        }
        // Already on this lesson — skip (unless it's the current selection being shown)
        if (video.lessonId === lessonId && video.id !== selectedId) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return (
          video.title.toLowerCase().includes(needle) ||
          video.originalFilename.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        // Prefer READY videos first
        if (a.status === VideoStatus.READY && b.status !== VideoStatus.READY) {
          return -1;
        }
        if (b.status === VideoStatus.READY && a.status !== VideoStatus.READY) {
          return 1;
        }
        return a.title.localeCompare(b.title);
      });
  }, [data?.videos, excluded, lessonId, query, selectedId]);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading library…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-rose-600">
        {getErrorMessage(error, 'Failed to load video library')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search library…"
        className={inputClassName}
        disabled={busy}
      />
      {videos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-blue-100 bg-white p-6 text-center text-sm text-slate-500">
          No available videos in the library
          {query.trim() ? ' match your search' : ''}.
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {videos.map((video) => {
            const selected = selectedId === video.id;
            return (
              <li key={video.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelect(video)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition disabled:opacity-50 ${
                    selected
                      ? 'border-accent bg-blue-50'
                      : 'border-blue-100 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-blue-50">
                    {video.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
                        No thumb
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{video.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {formatDuration(video.duration)}
                      {video.lessonName ? ` · ${video.lessonName}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={video.status} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function LibraryConfirmActions({
  selected,
  busy,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  selected: unknown | null;
  busy: boolean;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-full border border-blue-100 px-4 py-2 text-sm text-slate-600 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || !selected}
        className={`${primaryButtonClassName} sm:w-auto sm:px-6`}
      >
        {busy ? 'Saving…' : confirmLabel}
      </button>
    </div>
  );
}

/** @deprecated Prefer LibraryConfirmActions */
export const VideoLibraryConfirmActions = LibraryConfirmActions;
