import { departmentDetailPath, memberWorkspaceBase, type MemberLayer } from '@/lib/roles';
import type { WorkspaceNavLink } from '@/components/portals/shared/types';

/** Nav for a single member branch. URLs are /{tenant}/{username}/{learner|tutor}/… */
export function memberWorkspaceNav(input: {
  tenantSlug: string;
  userName: string;
  layer: MemberLayer;
  departments: Array<{ name: string; slug: string }>;
}): WorkspaceNavLink[] {
  const base = memberWorkspaceBase(input.tenantSlug, input.userName, input.layer);
  const departmentLinks: WorkspaceNavLink[] = input.departments.map((department) => ({
    href: departmentDetailPath(input.tenantSlug, department.slug, input.userName, input.layer),
    label: department.name,
    icon: 'departments',
  }));

  return [
    { href: base, label: 'Dashboard', icon: 'dashboard' },
    ...departmentLinks,
    { href: `${base}/live-sessions`, label: 'Live Sessions', icon: 'modules' },
    ...(input.layer === 'tutor'
      ? [{ href: `${base}/members`, label: 'Members', icon: 'members' as const }]
      : []),
    { href: `${base}/settings`, label: 'Settings', icon: 'settings' },
  ];
}
