import type { DepartmentDocument } from '../../models/index.js';

export function serializeDepartment(
  department: DepartmentDocument,
  extra: Record<string, unknown> = {},
) {
  return {
    id: String(department._id),
    name: department.name,
    slug: department.slug,
    description: department.description,
    tenantId: String(department.tenantId),
    createdBy: String(department.createdBy),
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
    thumbnailUrl: department.thumbnailStorageKey
      ? `/api/departments/${String(department._id)}/thumbnail`
      : null,
    ...extra,
  };
}
