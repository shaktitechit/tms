'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { DepartmentsListView } from '@/components/DepartmentsListView';
import { useAuth } from '@/lib/auth';
import { formatHours, seenProgressFromCompletedPercent, sumDurations } from '@/lib/format';
import { departmentDetailPath } from '@/lib/roles';
import { useGetUserProgressQuery } from '@/store/api';

export default function MemberOverviewPage() {
  const params = useParams<{ tenantSlug: string; userName: string }>();
  const { user } = useAuth();
  const { data } = useGetUserProgressQuery(params.userName, {
    skip: !params.userName || !user,
  });

  const departments = data?.departments ?? [];
  const modules = data?.modules ?? [];
  const lessons = useMemo(
    () => modules.flatMap((mod) => mod.lessons ?? []),
    [modules],
  );
  const totalHours = formatHours(sumDurations(lessons));
  const progress = seenProgressFromCompletedPercent(lessons);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Welcome, {user?.name}</h1>
        <p className="mt-2 text-slate-500">
          Browse your assigned departments, modules, lessons, and content.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Departments" value={String(departments.length)} />
        <Stat label="Modules" value={String(modules.length)} />
        <Stat label="Lessons" value={String(lessons.length)} />
        <Stat label="Total hours" value={totalHours} />
        <Stat label="Completed" value={`${progress.completedPercent}%`} />
        <Stat label="Pending" value={`${progress.pendingPercent}%`} />
      </div>

      <DepartmentsListView
        asSection
        departmentIds={data?.user.departmentIds ?? []}
        detailHref={(department) =>
          departmentDetailPath(params.tenantSlug, department.slug, params.userName)
        }
        description="Open a department to browse its modules."
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
