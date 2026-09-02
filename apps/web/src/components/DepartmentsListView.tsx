'use client';

import Link from 'next/link';
import type { DepartmentDto } from '@/lib/types';
import { getErrorMessage, useListDepartmentsQuery } from '@/store/api';

export function DepartmentFolderIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} aria-hidden>
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  );
}

export function DepartmentIconBadge() {
  return (
    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-accent">
      <DepartmentFolderIcon />
    </span>
  );
}

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
          {displayed.map((department) => {
            const moduleCount = department.moduleCount ?? 0;
            return (
              <Link
                key={department.id}
                href={detailHref(department)}
                className="flex gap-4 rounded-2xl border border-blue-100 bg-white p-4 transition hover:border-accent/40 hover:shadow-glow"
              >
                <DepartmentIconBadge />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900">{department.name}</h3>
                  <p className="text-sm text-slate-500">
                    /{department.slug} · {moduleCount} {moduleCount === 1 ? 'module' : 'modules'}
                  </p>
                  {department.description ? (
                    <p className="line-clamp-2 text-sm text-slate-500">{department.description}</p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
