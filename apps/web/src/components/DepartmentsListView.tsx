'use client';

import Link from 'next/link';
import type { DepartmentDto } from '@/lib/types';
import { getErrorMessage, useListDepartmentsQuery } from '@/store/api';

export function DepartmentsListView({
  detailHref,
  title = 'Departments',
  description = 'Group modules by department.',
  asSection = false,
  departmentIds,
}: {
  detailHref: (department: DepartmentDto) => string;
  title?: string;
  description?: string;
  asSection?: boolean;
  departmentIds?: string[];
}) {
  const { data, error, isLoading } = useListDepartmentsQuery();
  const allowedIds = departmentIds ? new Set(departmentIds) : null;
  const departments = (data?.departments ?? []).filter(
    (department) => !allowedIds || allowedIds.has(department.id),
  );
  const displayed = asSection ? departments.slice(0, 6) : departments;
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
      ) : departments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-8 text-center text-slate-500 sm:p-10">
          {allowedIds ? 'No assigned departments yet.' : 'No departments yet.'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {displayed.map((department) => (
            <Link
              key={department.id}
              href={detailHref(department)}
              className="overflow-hidden rounded-2xl border border-blue-100 bg-white transition hover:border-accent/40 hover:shadow-glow"
            >
              <div className="relative aspect-video bg-blue-50">
                {department.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={department.thumbnailUrl}
                    alt={department.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    No thumbnail
                  </div>
                )}
                <span className="absolute bottom-2 right-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-xs text-white">
                  {department.moduleCount ?? 0}{' '}
                  {(department.moduleCount ?? 0) === 1 ? 'module' : 'modules'}
                </span>
              </div>
              <div className="space-y-2 p-4">
                <h3 className="text-lg font-semibold text-slate-900">{department.name}</h3>
                <p className="text-sm text-slate-500">
                  /{department.slug} · {department.moduleCount ?? 0}{' '}
                  {(department.moduleCount ?? 0) === 1 ? 'module' : 'modules'}
                </p>
                {department.description ? (
                  <p className="line-clamp-2 text-sm text-slate-500">{department.description}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
