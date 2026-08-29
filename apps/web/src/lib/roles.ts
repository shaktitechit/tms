import type { AuthUser } from '@/lib/types';
import { MemberAccess } from '@video/shared';

export type AppRole = 'tenant' | 'user';

/** Access layer for `UserRole.USER`. Independent of tenant vs member role. */
export type MemberLayer = 'learner' | 'tutor';

export const TENANT_ROUTE_SEGMENTS = [
  'videos',
  'upload',
  'users',
  'departments',
  'settings',
] as const;

export function isTenantAdmin(user?: AuthUser | null): boolean {
  return memberAccessValue(user?.role) === 'tenant';
}

export function isMemberUser(user?: AuthUser | null): boolean {
  return memberAccessValue(user?.role) === 'user';
}

export function memberAccessValue(access?: string | null): string {
  return String(access ?? '').trim().toLowerCase();
}

/** Tutor vs learner for a member user. `null` when the account is not a member. */
export function memberLayer(user?: AuthUser | null): MemberLayer | null {
  if (!isMemberUser(user)) {
    return null;
  }
  return memberAccessValue(user?.access) === 'tutor' ? 'tutor' : 'learner';
}

export function isTutor(user?: AuthUser | null): boolean {
  return memberLayer(user) === 'tutor';
}

export function isLearner(user?: AuthUser | null): boolean {
  return memberLayer(user) === 'learner';
}

export function withMemberAccess(
  user: AuthUser | null | undefined,
  access?: string | null,
): AuthUser | null {
  if (!user) {
    return null;
  }
  if (memberAccessValue(user.access) === 'tutor' || memberAccessValue(access) === 'tutor') {
    return user.access === MemberAccess.TUTOR ? user : { ...user, access: MemberAccess.TUTOR };
  }
  const next = (access ?? user.access) as AuthUser['access'];
  if (next === user.access) {
    return user;
  }
  return { ...user, access: next };
}

/** Tenant admins and tutors can create/edit lesson curriculum. */
export function canManageCurriculum(user?: AuthUser | null): boolean {
  return isTenantAdmin(user) || isTutor(user);
}

export function canUpload(user?: AuthUser | null): boolean {
  return isTenantAdmin(user) || isTutor(user);
}

/** Tenant admins and tutors can schedule and host live sessions. */
export function canHostLiveSession(user?: AuthUser | null): boolean {
  return isTenantAdmin(user) || isTutor(user);
}

/** Stable post-login entry used by the login forms. */
export function dashboardEntry(role: AppRole): string {
  return role === 'tenant' ? '/dashboard/tenant' : '/dashboard/user';
}

/** Tenant admin home: /{tenantSlug} */
export function tenantHome(tenantSlug: string): string {
  return `/${tenantSlug}`;
}

/** Member home: /{tenantSlug}/{username} */
export function userHome(tenantSlug: string, username: string): string {
  return `/${tenantSlug}/${username}`;
}

/** Workspace home for the signed-in user. */
export function dashboardHome(user?: AuthUser | null): string {
  if (!user?.tenantSlug) {
    return '/';
  }
  if (user.role === 'tenant') {
    return tenantHome(user.tenantSlug);
  }
  if (user.role === 'user' && user.username) {
    return userHome(user.tenantSlug, user.username);
  }
  return '/';
}

export function videosPath(user?: AuthUser | null): string {
  return `${dashboardHome(user)}/videos`;
}

export function uploadPath(user?: AuthUser | null): string {
  if (!canUpload(user)) {
    return videosPath(user);
  }
  return `${dashboardHome(user)}/upload`;
}

export function settingsPath(user?: AuthUser | null): string {
  return `${dashboardHome(user)}/settings`;
}

export function videoDetailPath(user: AuthUser | null | undefined, slug: string): string {
  return `${videosPath(user)}/${slug}`;
}

export function watchPath(user: AuthUser | null | undefined, slug: string): string {
  return `${dashboardHome(user)}/watch/${slug}`;
}

/** Prefer slug for URLs; fall back to id for legacy payloads. */
export function videoSlugOf(video: { slug?: string; id: string }): string {
  return video.slug?.trim() || video.id;
}

/** Prefer slug for URLs; fall back to id for legacy payloads. */
export function audioSlugOf(audio: { slug?: string; id: string }): string {
  return audio.slug?.trim() || audio.id;
}

/** Tenant admin view of a member: /{tenantSlug}/users/{username} */
export function memberDetailPath(tenantSlug: string, username: string): string {
  return `/${tenantSlug}/users/${encodeURIComponent(username)}`;
}

export function departmentsPath(tenantSlug: string, userName?: string): string {
  return userName
    ? `/${tenantSlug}/${userName}/departments`
    : `/${tenantSlug}/departments`;
}

export function departmentDetailPath(
  tenantSlug: string,
  departmentSlug: string,
  userName?: string,
): string {
  return `${departmentsPath(tenantSlug, userName)}/${departmentSlug}`;
}

export function moduleDetailPath(
  tenantSlug: string,
  departmentSlug: string,
  moduleSlug: string,
  userName?: string,
): string {
  return `${departmentDetailPath(tenantSlug, departmentSlug, userName)}/modules/${moduleSlug}`;
}

export function lessonDetailPath(
  tenantSlug: string,
  departmentSlug: string,
  moduleSlug: string,
  lessonSlug: string,
  userName?: string,
): string {
  return `${moduleDetailPath(tenantSlug, departmentSlug, moduleSlug, userName)}/lessons/${lessonSlug}`;
}
