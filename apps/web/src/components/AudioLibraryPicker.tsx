'use client';

import { useMemo, useState } from 'react';
import { AudioStatus } from '@video/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { LibraryConfirmActions } from '@/components/VideoLibraryPicker';
import { inputClassName } from '@/components/portals';
import { formatDuration } from '@/lib/format';
import type { AudioDto } from '@/lib/types';
import { getErrorMessage, useListAudiosQuery } from '@/store/api';

export { LibraryConfirmActions };

export function AudioLibraryPicker({
  lessonId,
  excludeAudioIds = [],
  selectedId,
  onSelect,
  busy = false,
}: {
  lessonId: string;
  excludeAudioIds?: string[];
  selectedId?: string | null;
  onSelect: (audio: AudioDto) => void;
  busy?: boolean;
}) {
  const [query, setQuery] = useState('');
  const { data, error, isLoading } = useListAudiosQuery();

  const excluded = useMemo(() => new Set(excludeAudioIds), [excludeAudioIds]);

  const audios = useMemo(() => {
    const list = data?.audios ?? [];
    const needle = query.trim().toLowerCase();
    return list
      .filter((audio) => {
        if (excluded.has(audio.id)) {
          return false;
        }
        if (audio.lessonId === lessonId && audio.id !== selectedId) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return (
          audio.title.toLowerCase().includes(needle) ||
          audio.originalFilename.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if (a.status === AudioStatus.READY && b.status !== AudioStatus.READY) {
          return -1;
        }
        if (b.status === AudioStatus.READY && a.status !== AudioStatus.READY) {
          return 1;
        }
        return a.title.localeCompare(b.title);
      });
  }, [data?.audios, excluded, lessonId, query, selectedId]);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading library…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-rose-600">
        {getErrorMessage(error, 'Failed to load audio library')}
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
      {audios.length === 0 ? (
        <p className="rounded-xl border border-dashed border-blue-100 bg-white p-6 text-center text-sm text-slate-500">
          No available audios in the library
          {query.trim() ? ' match your search' : ''}.
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {audios.map((audio) => {
            const selected = selectedId === audio.id;
            return (
              <li key={audio.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelect(audio)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition disabled:opacity-50 ${
                    selected
                      ? 'border-accent bg-blue-50'
                      : 'border-blue-100 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-medium text-accent">
                    Audio
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{audio.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {formatDuration(audio.duration)}
                      {audio.lessonName ? ` · ${audio.lessonName}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={audio.status} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
