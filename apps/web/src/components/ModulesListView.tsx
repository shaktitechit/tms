'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { ModuleDto } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import {
  durationsByModuleId,
  emptySeenProgress,
  formatDuration,
  seenProgressByModuleId,
} from '@/lib/format';
import { getErrorMessage, useListModulesQuery, useListVideosQuery } from '@/store/api';
import { SeenProgressSummary } from '@/components/SeenProgressSummary';

export function ModulesListView({
  detailHref,
  title = 'Modules',
  description = 'Browse video modules in your tenant.',
  asSection = false,
}: {
  detailHref: (module: ModuleDto) => string;
  title?: string;
  description?: string;
  asSection?: boolean;
}) {
  const { user } = useAuth();
  const { data, error, isLoading } = useListModulesQuery();
  const { data: videosData } = useListVideosQuery({ role: user?.role }, { skip: !user });
  const modules = data?.modules ?? [];
  const displayed = asSection ? modules.slice(0, 6) : modules;
  const durationByModule = useMemo(
    () => durationsByModuleId(videosData?.videos ?? []),
    [videosData?.videos],
  );
  const progressByModule = useMemo(
    () => seenProgressByModuleId(videosData?.videos ?? []),
    [videosData?.videos],
  );
  const Heading = asSection ? 'h2' : 'h1';

  return (
    <div className="space-y-8">
      <div>
        <Heading
          className={
            asSection
              ? 'text-xl font-semibold text-slate-900 sm:text-2xl'
              : 'text-2xl font-semibold text-slate-900 sm:text-3xl'
          }
        >
          {title}
        </Heading>
        <p className="mt-1 text-slate-500">{description}</p>
      </div>

      {error ? <p className="text-rose-600">{getErrorMessage(error)}</p> : null}

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : modules.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-8 text-center text-slate-500 sm:p-10">
          No modules yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map((module) => (
            <Link
              key={module.id}
              href={detailHref(module)}
              className="overflow-hidden rounded-2xl border border-blue-100 bg-white transition hover:border-accent/40 hover:shadow-glow"
            >
              <div className="relative aspect-video bg-blue-50">
                {module.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={module.thumbnailUrl}
                    alt={module.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    No thumbnail
                  </div>
                )}
                <span className="absolute bottom-2 right-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-xs text-white">
                  {formatDuration(durationByModule.get(module.id) ?? 0)}
                </span>
              </div>
              <div className="space-y-2 p-4">
                <h3 className="text-lg font-semibold text-slate-900">{module.name}</h3>
                <p className="text-sm text-slate-500">
                  /{module.slug} · {formatDuration(durationByModule.get(module.id) ?? 0)} total
                </p>
                <SeenProgressSummary
                  progress={progressByModule.get(module.id) ?? emptySeenProgress}
                />
                {module.description ? (
                  <p className="line-clamp-2 text-sm text-slate-500">{module.description}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
