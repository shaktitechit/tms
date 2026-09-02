'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ContentSeenStatus } from '@video/shared';
import { SeenStatusBadge } from '@/components/SeenStatusBadge';
import { formatDuration, quizDurationSeconds, sumDurations } from '@/lib/format';
import {
  departmentDetailPath,
  lessonDetailPath,
  moduleDetailPath,
} from '@/lib/roles';
import type {
  DepartmentDto,
  LessonDto,
  ModuleDto,
  QuizDto,
} from '@/lib/types';
import { getErrorMessage, useGetUserProgressQuery } from '@/store/api';

type ProgressTab =
  | 'departments'
  | 'modules'
  | 'videos'
  | 'audios'
  | 'pdfs'
  | 'images'
  | 'textAreas'
  | 'quizzes';

type GroupedItem = {
  id: string;
  title: string;
  lessonId: string | null;
  moduleName?: string | null;
  lessonName?: string | null;
  duration?: number | null;
  seenStatus?: string | null;
  questions?: Array<{ duration?: number | null }>;
};

function groupModulesByDepartment(departments: DepartmentDto[], modules: ModuleDto[]) {
  const byDepartment = new Map<string, ModuleDto[]>();
  for (const mod of modules) {
    if (!mod.departmentId) {
      continue;
    }
    const list = byDepartment.get(mod.departmentId) ?? [];
    list.push(mod);
    byDepartment.set(mod.departmentId, list);
  }
  const assignedIds = new Set(departments.map((department) => department.id));
  return {
    grouped: departments.map((department) => ({
      department,
      modules: byDepartment.get(department.id) ?? [],
    })),
    leftover: modules.filter(
      (mod) => !mod.departmentId || !assignedIds.has(mod.departmentId),
    ),
  };
}

function itemDuration(item: GroupedItem): number | null {
  if (typeof item.duration === 'number' && item.duration > 0) {
    return item.duration;
  }
  if (item.questions) {
    return quizDurationSeconds(item.questions);
  }
  return null;
}

export function MemberProgressView({
  tenantSlug,
  userSlug,
}: {
  tenantSlug: string;
  userSlug: string;
}) {
  const { data, error, isLoading } = useGetUserProgressQuery(userSlug, { skip: !userSlug });
  const [tab, setTab] = useState<ProgressTab>('departments');
  const member = data?.user;
  const departments = data?.departments ?? [];
  const modules = data?.modules ?? [];
  const videos = data?.videos ?? [];
  const audios = data?.audios ?? [];
  const pdfs = data?.pdfs ?? [];
  const images = data?.images ?? [];
  const textAreas = data?.textAreas ?? [];
  const quizzes = data?.quizzes ?? [];

  const tabs: Array<{ id: ProgressTab; label: string; count: number }> = [
    { id: 'departments', label: 'Assigned departments', count: departments.length },
    { id: 'modules', label: 'Assigned modules & lessons', count: modules.length },
    { id: 'videos', label: 'Videos', count: videos.length },
    { id: 'audios', label: 'Audio', count: audios.length },
    { id: 'pdfs', label: 'PDFs', count: pdfs.length },
    { id: 'images', label: 'Images', count: images.length },
    { id: 'textAreas', label: 'Text areas', count: textAreas.length },
    { id: 'quizzes', label: 'Quizzes', count: quizzes.length },
  ];

  return (
    <div className="space-y-8">
      <div>
        {isLoading ? (
          <p className="text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-rose-600">{getErrorMessage(error)}</p>
        ) : member ? (
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{member.name}</h1>
            <p className="mt-1 text-slate-500">
              @{member.username}
              {member.email ? ` · ${member.email}` : ''}
              {member.role === 'user' && member.access ? ` · ${member.access}` : ''}
            </p>
          </div>
        ) : (
          <h1 className="text-2xl font-semibold text-slate-900">Member</h1>
        )}
      </div>

      {data ? (
        <>
          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-1 rounded-full border border-blue-100 bg-slate-50 p-1">
              {tabs.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      active ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
                    }`}
                  >
                    {item.label}
                    <span className={`ml-1.5 tabular-nums ${active ? 'text-accent' : 'text-slate-400'}`}>
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {tab === 'departments' ? (
            <DepartmentsTab
              tenantSlug={tenantSlug}
              departments={departments}
            />
          ) : null}
          {tab === 'modules' ? (
            <ModulesTab
              tenantSlug={tenantSlug}
              departments={departments}
              modules={modules}
              quizzes={quizzes}
            />
          ) : null}
          {tab === 'videos' ? (
            <GroupedContentTab
              tenantSlug={tenantSlug}
              departments={departments}
              modules={modules}
              items={videos}
              fromLesson={(lesson) => lesson.videos}
              empty="No videos in assigned departments yet."
              singular="video"
              plural="videos"
            />
          ) : null}
          {tab === 'audios' ? (
            <GroupedContentTab
              tenantSlug={tenantSlug}
              departments={departments}
              modules={modules}
              items={audios}
              fromLesson={(lesson) => lesson.audios}
              empty="No audio in assigned departments yet."
              singular="audio"
              plural="audios"
            />
          ) : null}
          {tab === 'pdfs' ? (
            <GroupedContentTab
              tenantSlug={tenantSlug}
              departments={departments}
              modules={modules}
              items={pdfs}
              fromLesson={(lesson) => lesson.pdfs}
              empty="No PDFs in assigned departments yet."
              singular="PDF"
              plural="PDFs"
            />
          ) : null}
          {tab === 'images' ? (
            <GroupedContentTab
              tenantSlug={tenantSlug}
              departments={departments}
              modules={modules}
              items={images}
              fromLesson={(lesson) => lesson.images}
              empty="No images in assigned departments yet."
              singular="image"
              plural="images"
            />
          ) : null}
          {tab === 'textAreas' ? (
            <GroupedContentTab
              tenantSlug={tenantSlug}
              departments={departments}
              modules={modules}
              items={textAreas}
              fromLesson={(lesson) => lesson.textAreas}
              empty="No text areas in assigned departments yet."
              singular="text area"
              plural="text areas"
            />
          ) : null}
          {tab === 'quizzes' ? (
            <GroupedContentTab
              tenantSlug={tenantSlug}
              departments={departments}
              modules={modules}
              items={quizzes}
              fromLesson={(lesson) => lesson.quizzes}
              empty="No quizzes in assigned departments yet."
              singular="quiz"
              plural="quizzes"
              extraHeader="Score"
              extraCell={(item) => <QuizScore quiz={item as QuizDto} />}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function DepartmentsTab({
  tenantSlug,
  departments,
}: {
  tenantSlug: string;
  departments: DepartmentDto[];
}) {
  if (departments.length === 0) {
    return <EmptyState message="No assigned departments yet." />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {departments.map((department) => {
        const href = department.slug
          ? departmentDetailPath(tenantSlug, department.slug)
          : null;
        const body = (
          <>
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
          </>
        );

        return href ? (
          <Link
            key={department.id}
            href={href}
            className="overflow-hidden rounded-2xl border border-blue-100 bg-white transition hover:border-accent/40 hover:shadow-glow"
          >
            {body}
          </Link>
        ) : (
          <div
            key={department.id}
            className="overflow-hidden rounded-2xl border border-blue-100 bg-white"
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}

function ModulesTab({
  tenantSlug,
  departments,
  modules,
  quizzes,
}: {
  tenantSlug: string;
  departments: DepartmentDto[];
  modules: ModuleDto[];
  quizzes: QuizDto[];
}) {
  const quizzesByLesson = useMemo(() => {
    const map = new Map<string, QuizDto[]>();
    for (const quiz of quizzes) {
      if (!quiz.lessonId) {
        continue;
      }
      const list = map.get(quiz.lessonId) ?? [];
      list.push(quiz);
      map.set(quiz.lessonId, list);
    }
    return map;
  }, [quizzes]);

  const { grouped, leftover } = useMemo(
    () => groupModulesByDepartment(departments, modules),
    [departments, modules],
  );

  if (modules.length === 0) {
    return <EmptyState message="No assigned modules yet." />;
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ department, modules: departmentModules }) => {
        if (departmentModules.length === 0) {
          return null;
        }
        const href = department.slug
          ? departmentDetailPath(tenantSlug, department.slug)
          : null;
        const title = href ? (
          <Link href={href} className="hover:text-accent">
            {department.name}
          </Link>
        ) : (
          department.name
        );

        return (
          <section
            key={department.id}
            className="overflow-hidden rounded-2xl border border-blue-100 bg-white"
          >
            <div className="border-b border-blue-50 p-4">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                /{department.slug} · {departmentModules.length}{' '}
                {departmentModules.length === 1 ? 'module' : 'modules'}
              </p>
            </div>
            {departmentModules.map((mod) => (
              <ModuleBlock
                key={mod.id}
                tenantSlug={tenantSlug}
                module={mod}
                quizzesByLesson={quizzesByLesson}
              />
            ))}
          </section>
        );
      })}
      {leftover.map((mod) => (
        <ModuleBlock
          key={mod.id}
          tenantSlug={tenantSlug}
          module={mod}
          quizzesByLesson={quizzesByLesson}
        />
      ))}
    </div>
  );
}

function ModuleBlock({
  tenantSlug,
  module,
  quizzesByLesson,
}: {
  tenantSlug: string;
  module: ModuleDto;
  quizzesByLesson: Map<string, QuizDto[]>;
}) {
  const lessons = (module.lessons ?? []).map((lesson) => ({
    ...lesson,
    quizzes:
      lesson.quizzes && lesson.quizzes.length > 0
        ? lesson.quizzes
        : (quizzesByLesson.get(lesson.id) ?? []),
  }));
  const href =
    module.departmentSlug && module.slug
      ? moduleDetailPath(tenantSlug, module.departmentSlug, module.slug)
      : null;
  const title = href ? (
    <Link href={href} className="hover:text-accent">
      {module.name}
    </Link>
  ) : (
    module.name
  );

  return (
    <div className="border-t border-blue-50">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-blue-50">
          {module.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={module.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            /{module.slug} · {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'} ·{' '}
            {formatDuration(sumDurations(lessons))} total
          </p>
        </div>
      </div>
      <LessonTable tenantSlug={tenantSlug} module={module} lessons={lessons} />
    </div>
  );
}

function LessonTable({
  tenantSlug,
  module,
  lessons,
}: {
  tenantSlug: string;
  module: ModuleDto;
  lessons: LessonDto[];
}) {
  if (lessons.length === 0) {
    return <p className="p-6 text-sm text-slate-500">No lessons in this module yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="bg-blue-50 text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Lesson</th>
            <th className="px-4 py-3 font-medium">Duration</th>
            <th className="px-4 py-3 font-medium">Completed</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((lesson) => {
            const href =
              module.departmentSlug && lesson.slug
                ? lessonDetailPath(tenantSlug, module.departmentSlug, module.slug, lesson.slug)
                : null;
            const name = href ? (
              <Link href={href} className="font-medium text-slate-900 hover:text-accent">
                {lesson.name}
              </Link>
            ) : (
              <span className="font-medium text-slate-900">{lesson.name}</span>
            );
            return (
              <tr key={lesson.id} className="border-t border-blue-50">
                <td className="px-4 py-3">
                  {name}
                  <p className="mt-0.5 text-xs text-slate-500">/{lesson.slug}</p>
                  <LessonQuizzes lesson={lesson} />
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-700">
                  {formatDuration(lesson.duration)}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-700">
                  {lesson.completedPercent ?? 0}%
                </td>
                <td className="px-4 py-3">
                  <SeenStatusBadge status={lesson.seenStatus} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LessonQuizzes({ lesson }: { lesson: LessonDto }) {
  const quizzes = lesson.quizzes ?? [];
  if (quizzes.length === 0) {
    return null;
  }

  return (
    <ul className="mt-2 space-y-1">
      {quizzes.map((quiz) => (
        <li key={quiz.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="font-medium text-slate-800">{quiz.title}</span>
          <SeenStatusBadge status={quiz.seenStatus} />
          {quiz.seenStatus === ContentSeenStatus.COMPLETED ? <QuizScore quiz={quiz} /> : null}
        </li>
      ))}
    </ul>
  );
}

function GroupedContentTab<T extends GroupedItem>({
  tenantSlug,
  departments,
  modules,
  items,
  fromLesson,
  empty,
  singular,
  plural,
  extraHeader,
  extraCell,
}: {
  tenantSlug: string;
  departments: DepartmentDto[];
  modules: ModuleDto[];
  items: T[];
  fromLesson?: (lesson: LessonDto) => T[] | undefined;
  empty: string;
  singular: string;
  plural: string;
  extraHeader?: string;
  extraCell?: (item: T) => ReactNode;
}) {
  const itemsByLesson = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const item of items) {
      if (!item.lessonId) {
        continue;
      }
      const list = map.get(item.lessonId) ?? [];
      list.push(item);
      map.set(item.lessonId, list);
    }
    return map;
  }, [items]);

  const moduleGroups = modules
    .map((mod) => ({
      module: mod,
      lessons: (mod.lessons ?? [])
        .map((lesson) => {
          const nested = fromLesson?.(lesson);
          return {
            lesson,
            items: (nested && nested.length > 0 ? nested : itemsByLesson.get(lesson.id)) ?? [],
          };
        })
        .filter((row) => row.items.length > 0),
    }))
    .filter((group) => group.lessons.length > 0);

  const { grouped, leftover: leftoverModules } = groupModulesByDepartment(
    departments,
    moduleGroups.map((group) => group.module),
  );
  const moduleGroupById = new Map(moduleGroups.map((group) => [group.module.id, group]));
  const departmentGroups = grouped
    .map(({ department, modules: departmentModules }) => ({
      department,
      modules: departmentModules
        .map((mod) => moduleGroupById.get(mod.id))
        .filter((group): group is (typeof moduleGroups)[number] => Boolean(group)),
    }))
    .filter((group) => group.modules.length > 0);
  const leftoverModuleGroups = leftoverModules
    .map((mod) => moduleGroupById.get(mod.id))
    .filter((group): group is (typeof moduleGroups)[number] => Boolean(group));

  const listedIds = new Set(
    [...departmentGroups.flatMap((group) => group.modules), ...leftoverModuleGroups].flatMap(
      (group) => group.lessons.flatMap((row) => row.items.map((item) => item.id)),
    ),
  );
  const leftover = items.filter((item) => !listedIds.has(item.id));

  if (departmentGroups.length === 0 && leftoverModuleGroups.length === 0 && leftover.length === 0) {
    return <EmptyState message={empty} />;
  }

  return (
    <div className="space-y-6">
      {departmentGroups.map(({ department, modules: departmentModules }) => {
        const href = department.slug
          ? departmentDetailPath(tenantSlug, department.slug)
          : null;
        const title = href ? (
          <Link href={href} className="hover:text-accent">
            {department.name}
          </Link>
        ) : (
          department.name
        );
        const count = departmentModules.reduce(
          (sum, group) => sum + group.lessons.reduce((lessonSum, row) => lessonSum + row.items.length, 0),
          0,
        );

        return (
          <section
            key={department.id}
            className="overflow-hidden rounded-2xl border border-blue-100 bg-white"
          >
            <div className="border-b border-blue-50 p-4">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                /{department.slug} · {count} {count === 1 ? singular : plural}
              </p>
            </div>
            {departmentModules.map((group) => (
              <ModuleContentGroup
                key={group.module.id}
                tenantSlug={tenantSlug}
                module={group.module}
                lessons={group.lessons}
                extraHeader={extraHeader}
                extraCell={extraCell}
              />
            ))}
          </section>
        );
      })}
      {leftoverModuleGroups.map((group) => (
        <section
          key={group.module.id}
          className="overflow-hidden rounded-2xl border border-blue-100 bg-white"
        >
          <ModuleContentGroup
            tenantSlug={tenantSlug}
            module={group.module}
            lessons={group.lessons}
            extraHeader={extraHeader}
            extraCell={extraCell}
          />
        </section>
      ))}
      {leftover.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
          <div className="border-b border-blue-50 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Other {plural}</h2>
            <p className="mt-1 text-sm text-slate-500">From assigned departments, modules, and lessons</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-blue-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Module</th>
                  <th className="px-4 py-2 font-medium">Lesson</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  {extraHeader ? <th className="px-4 py-2 font-medium">{extraHeader}</th> : null}
                </tr>
              </thead>
              <tbody>
                {leftover.map((item) => (
                  <tr key={item.id} className="border-t border-blue-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                    <td className="px-4 py-3 text-slate-600">{item.moduleName || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.lessonName || '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {formatDuration(itemDuration(item))}
                    </td>
                    <td className="px-4 py-3">
                      <SeenStatusBadge status={item.seenStatus} />
                    </td>
                    {extraCell ? (
                      <td className="px-4 py-3 text-slate-700">{extraCell(item)}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ModuleContentGroup<T extends GroupedItem>({
  tenantSlug,
  module,
  lessons,
  extraHeader,
  extraCell,
}: {
  tenantSlug: string;
  module: ModuleDto;
  lessons: Array<{ lesson: LessonDto; items: T[] }>;
  extraHeader?: string;
  extraCell?: (item: T) => ReactNode;
}) {
  const href =
    module.departmentSlug && module.slug
      ? moduleDetailPath(tenantSlug, module.departmentSlug, module.slug)
      : null;
  const title = href ? (
    <Link href={href} className="hover:text-accent">
      {module.name}
    </Link>
  ) : (
    module.name
  );

  return (
    <div className="border-t border-blue-50">
      <div className="bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">
        {title}
        <span className="ml-2 font-normal text-slate-500">/{module.slug}</span>
      </div>
      {lessons.map(({ lesson, items: lessonItems }) => {
        const lessonHref =
          module.departmentSlug && lesson.slug
            ? lessonDetailPath(tenantSlug, module.departmentSlug, module.slug, lesson.slug)
            : null;
        const lessonTitle = lessonHref ? (
          <Link href={lessonHref} className="hover:text-accent">
            {lesson.name}
          </Link>
        ) : (
          lesson.name
        );

        return (
          <div key={lesson.id} className="border-t border-blue-50">
            <div className="bg-blue-50/60 px-4 py-2 text-sm font-medium text-slate-800">
              {lessonTitle}
              <span className="ml-2 font-normal text-slate-500">/{lesson.slug}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Title</th>
                    <th className="px-4 py-2 font-medium">Duration</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    {extraHeader ? <th className="px-4 py-2 font-medium">{extraHeader}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {lessonItems.map((item) => (
                    <tr key={item.id} className="border-t border-blue-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {lessonHref ? (
                          <Link href={lessonHref} className="hover:text-accent">
                            {item.title}
                          </Link>
                        ) : (
                          item.title
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {formatDuration(itemDuration(item))}
                      </td>
                      <td className="px-4 py-3">
                        <SeenStatusBadge status={item.seenStatus} />
                      </td>
                      {extraCell ? (
                        <td className="px-4 py-3 text-slate-700">{extraCell(item)}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuizScore({ quiz }: { quiz?: QuizDto }) {
  if (!quiz || quiz.seenStatus !== ContentSeenStatus.COMPLETED || !quiz.result) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <span className="tabular-nums">
      {quiz.result.score} / {quiz.result.totalQuestions}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-8 text-center text-slate-500 sm:p-10">
      {message}
    </p>
  );
}
