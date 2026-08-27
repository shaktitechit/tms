'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DepartmentsListView } from '@/components/DepartmentsListView';
import { useAuth } from '@/lib/auth';
import { formatHours, seenProgressFromCompletedPercent, sumDurations } from '@/lib/format';
import { departmentDetailPath } from '@/lib/roles';
import {
  useGetTenantMeQuery,
  useListDepartmentsQuery,
  useListLessonsQuery,
  useListModulesQuery,
  useListUsersQuery,
} from '@/store/api';

export default function TenantOverviewPage() {
  const params = useParams<{ tenantSlug: string }>();
  const slug = params.tenantSlug;
  const { user } = useAuth();
  const { data: tenantData } = useGetTenantMeQuery();
  const { data: departmentsData } = useListDepartmentsQuery();
  const { data: modulesData } = useListModulesQuery();
  const { data: lessonsData } = useListLessonsQuery();
  const { data: usersData } = useListUsersQuery();

  const departments = departmentsData?.departments ?? [];
  const modules = modulesData?.modules ?? [];
  const lessons = lessonsData?.lessons ?? [];
  const totalHours = formatHours(sumDurations(lessons));
  const progress = seenProgressFromCompletedPercent(lessons);
  const userCount = usersData?.users.length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          {tenantData?.tenant.name ?? 'Tenant overview'}
        </h1>
        <p className="mt-2 text-slate-500">
          Signed in as {user?.name}. Workspace{' '}
          <span className="text-slate-800">/{slug}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Departments" value={String(departments.length)} />
        <Stat label="Modules" value={String(modules.length)} />
        <Stat label="Lessons" value={String(lessons.length)} />
        <Stat label="Total hours" value={totalHours} />
        <Stat label="Completed" value={`${progress.completedPercent}%`} />
        <Stat label="Pending" value={`${progress.pendingPercent}%`} />
        <Stat label="Members" value={String(userCount)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <QuickLink href={`/${slug}/videos`} title="Library" body="Browse all tenant videos" />
        <QuickLink href={`/${slug}/upload`} title="Upload" body="Add a new video" />
        <QuickLink
          href={`/${slug}/departments`}
          title="Departments"
          body="Organise modules by team"
        />
        <QuickLink href={`/${slug}/users`} title="Members" body="Invite and manage members" />
        <QuickLink href={`/${slug}/settings`} title="Settings" body="Workspace name and details" />
      </div>

      <DepartmentsListView
        asSection
        detailHref={(department) => departmentDetailPath(slug, department.slug)}
        description="Open a department to browse and manage its modules."
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

function QuickLink({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-blue-100 bg-white p-5 transition hover:border-accent/40 hover:shadow-glow"
    >
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-slate-500">{body}</p>
    </Link>
  );
}
