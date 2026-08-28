import type { AppRole } from '@/lib/roles';
import { TENANT_ROUTE_SEGMENTS } from '@/lib/roles';

export type PortalId = 'public' | 'tenant' | 'member';

export type PortalConfig = {
  id: PortalId;
  label: string;
  description: string;
  role?: AppRole;
  loginPath: string;
  registerPath?: string;
  loginIntent?: string;
  registerIntent?: string;
};

export const PORTALS: Record<PortalId, PortalConfig> = {
  public: {
    id: 'public',
    label: 'TMS',
    description: 'Upload, transcode, and stream adaptive HLS video.',
    loginPath: '/login',
  },
  tenant: {
    id: 'tenant',
    label: 'Admin',
    description: 'Manage your organization, members, and all tenant videos.',
    role: 'tenant',
    loginPath: '/login/tenant',
    registerPath: '/register',
    loginIntent: 'login-tenant',
    registerIntent: 'register',
  },
  member: {
    id: 'member',
    label: 'Learner and Tutor',
    description: 'Browse and watch videos in your tenant library.',
    role: 'user',
    loginPath: '/login/user',
    loginIntent: 'login-user',
  },
};

const RESERVED_ROOT = new Set([
  'api',
  'login',
  'register',
  'watch',
  'upload',
  'videos',
  'dashboard',
  '_next',
]);

const TENANT_SECTIONS = new Set<string>(TENANT_ROUTE_SEGMENTS);

/** Workspace routes under /{tenantSlug}/… */
export function isWorkspacePath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) {
    return false;
  }
  return !RESERVED_ROOT.has(parts[0]!);
}

/** Which portal owns the current URL. */
export function resolvePortalFromPath(pathname: string): PortalId {
  if (pathname === '/login/tenant' || pathname === '/register') {
    return 'tenant';
  }
  if (pathname === '/login/user') {
    return 'member';
  }

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 1 && !RESERVED_ROOT.has(parts[0]!)) {
    if (parts.length >= 2 && !TENANT_SECTIONS.has(parts[1]!)) {
      return 'member';
    }
    return 'tenant';
  }

  return 'public';
}

export function portalLoginPath(portalId: PortalId): string {
  return PORTALS[portalId].loginPath;
}
