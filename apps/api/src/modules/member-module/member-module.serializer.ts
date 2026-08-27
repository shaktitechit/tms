import type { MemberModuleDocument } from '../../models/index.js';
import type mongoose from 'mongoose';

type PopulatedModule = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string | null;
  departmentId?: mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId } | null;
};

function refId(raw: unknown): string | null {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'object' && raw !== null && '_id' in raw) {
    return String((raw as { _id: unknown })._id);
  }
  return String(raw);
}

function moduleFields(raw: unknown) {
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    const mod = raw as PopulatedModule;
    return {
      moduleId: String(mod._id),
      moduleName: mod.name,
      moduleSlug: mod.slug ?? null,
      departmentId: refId(mod.departmentId),
    };
  }
  return {
    moduleId: raw ? String(raw) : null,
    moduleName: null as string | null,
    moduleSlug: null as string | null,
    departmentId: null as string | null,
  };
}

export function serializeMemberModule(doc: MemberModuleDocument) {
  const fields = moduleFields(doc.moduleId as unknown);
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    moduleId: fields.moduleId,
    moduleName: fields.moduleName,
    moduleSlug: fields.moduleSlug,
    departmentId: fields.departmentId ?? (doc.departmentId ? String(doc.departmentId) : null),
    tenantId: String(doc.tenantId),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function allowedModuleSummary(doc: MemberModuleDocument) {
  const serialized = serializeMemberModule(doc);
  return {
    id: serialized.moduleId ?? '',
    name: serialized.moduleName ?? '',
    slug: serialized.moduleSlug,
    departmentId: serialized.departmentId,
  };
}
