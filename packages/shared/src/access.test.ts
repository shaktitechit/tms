import { describe, expect, it } from 'vitest';
import { canManageVideo, canWatchVideo } from './access.js';
import { UserRole, VideoVisibility } from './types.js';

describe('video access', () => {
  const tenantId = 'tenant-1';
  const owner = { id: 'owner-1', role: UserRole.USER, tenantId };
  const other = { id: 'other-1', role: UserRole.USER, tenantId: 'tenant-2' };
  const tenantAdmin = { id: 'admin-1', role: UserRole.TENANT, tenantId };

  it('allows anyone to watch public and unlisted videos', () => {
    expect(canWatchVideo(VideoVisibility.PUBLIC, owner.id)).toBe(true);
    expect(canWatchVideo(VideoVisibility.UNLISTED, owner.id, other)).toBe(true);
  });

  it('restricts private videos to owner and same-tenant admin', () => {
    expect(canWatchVideo(VideoVisibility.PRIVATE, owner.id)).toBe(false);
    expect(canWatchVideo(VideoVisibility.PRIVATE, owner.id, other, tenantId)).toBe(false);
    expect(canWatchVideo(VideoVisibility.PRIVATE, owner.id, owner, tenantId)).toBe(true);
    expect(canWatchVideo(VideoVisibility.PRIVATE, owner.id, tenantAdmin, tenantId)).toBe(true);
  });

  it('allows only owner and same-tenant admin to manage a video', () => {
    expect(canManageVideo(owner.id, other, tenantId)).toBe(false);
    expect(canManageVideo(owner.id, owner, tenantId)).toBe(true);
    expect(canManageVideo(owner.id, tenantAdmin, tenantId)).toBe(true);
    expect(
      canManageVideo(owner.id, { ...tenantAdmin, tenantId: 'other-tenant' }, tenantId),
    ).toBe(false);
  });
});
