import { UserRole, VideoStatus, VideoVisibility } from './types.js';

export interface AuthUser {
  id: string;
  role: string;
  tenantId?: string;
}

function isTenantAdmin(user: AuthUser, videoTenantId?: string): boolean {
  return (
    user.role === UserRole.TENANT &&
    Boolean(user.tenantId) &&
    Boolean(videoTenantId) &&
    user.tenantId === videoTenantId
  );
}

export function canWatchVideo(
  visibility: VideoVisibility | string,
  createdBy: string,
  user?: AuthUser | null,
  videoTenantId?: string,
): boolean {
  if (visibility === VideoVisibility.PUBLIC || visibility === VideoVisibility.UNLISTED) {
    return true;
  }
  if (!user) {
    return false;
  }
  return user.id === createdBy || isTenantAdmin(user, videoTenantId);
}

export function canManageVideo(
  createdBy: string,
  user?: AuthUser | null,
  videoTenantId?: string,
): boolean {
  if (!user) {
    return false;
  }
  return user.id === createdBy || isTenantAdmin(user, videoTenantId);
}

export function isTerminalStatus(status: VideoStatus | string): boolean {
  return status === VideoStatus.READY || status === VideoStatus.FAILED;
}
