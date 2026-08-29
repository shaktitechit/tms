import { departmentDetailPath } from '@/lib/roles';
import type { WorkspaceNavLink } from '@/components/portals/shared/types';

/** Member workspace nav. Tutors and learners share role `user`; tutors get the Members tab. */
export function memberWorkspaceNav(input: {
  tenantSlug: string;
  userName: string;
  departments: Array<{ name: string; slug: string }>;
  isTutor?: boolean;
}): WorkspaceNavLink[] {
  const base = `/${input.tenantSlug}/${input.userName}`;
  const departmentLinks: WorkspaceNavLink[] = input.departments.map((department) => ({
    href: departmentDetailPath(input.tenantSlug, department.slug, input.userName),
    label: department.name,
    icon: 'departments',
  }));

  return [
    { href: base, label: 'Dashboard', icon: 'dashboard' },
    ...departmentLinks,
    { href: `${base}/videos`, label: 'Library', icon: 'library' },
    { href: `${base}/live-sessions`, label: 'Live Sessions', icon: 'modules' },
    ...(input.isTutor ? [{ href: `${base}/members`, label: 'Members', icon: 'members' as const }] : []),
    { href: `${base}/upload`, label: 'Upload', icon: 'upload' },
    { href: `${base}/settings`, label: 'Settings', icon: 'settings' },
  ];
}
