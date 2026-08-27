import type { TenantDocument } from '../../models/index.js';

export function serializeTenant(tenant: TenantDocument) {
  return {
    id: String(tenant._id),
    name: tenant.name,
    slug: tenant.slug,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    logoUrl: tenant.logoStorageKey
      ? `/api/tenants/me/logo?v=${new Date(tenant.updatedAt).getTime()}`
      : null,
  };
}
