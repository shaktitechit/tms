import type { ModuleDocument } from '../../models/index.js';
import type mongoose from 'mongoose';

type PopulatedDepartment = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string | null;
};

function departmentFields(mod: ModuleDocument) {
  const raw = mod.departmentId as unknown;
  if (!raw) {
    return { departmentId: null, departmentName: null, departmentSlug: null };
  }
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    const department = raw as PopulatedDepartment;
    return {
      departmentId: String(department._id),
      departmentName: department.name,
      departmentSlug: department.slug ?? null,
    };
  }
  return {
    departmentId: String(raw),
    departmentName: null,
    departmentSlug: null,
  };
}

export function serializeModule(mod: ModuleDocument) {
  return {
    id: String(mod._id),
    name: mod.name,
    slug: mod.slug,
    description: mod.description,
    authorName: mod.authorName,
    authorEmail: mod.authorEmail,
    tenantId: String(mod.tenantId),
    ...departmentFields(mod),
    createdAt: mod.createdAt,
    updatedAt: mod.updatedAt,
    thumbnailUrl: mod.thumbnailStorageKey
      ? `/api/modules/${String(mod._id)}/thumbnail`
      : null,
  };
}
