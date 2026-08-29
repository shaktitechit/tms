import type { UserDocument } from '../../models/index.js';
import type mongoose from 'mongoose';
import { MemberAccess } from '@video/shared';

type PopulatedRef = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string | null;
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

function serializeNamedRef(raw: unknown): { id: string; name: string; slug: string | null } | null {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    const item = raw as PopulatedRef;
    return {
      id: String(item._id),
      name: item.name,
      slug: item.slug ?? null,
    };
  }
  const id = refId(raw);
  return id ? { id, name: '', slug: null } : null;
}

function departmentFields(user: UserDocument) {
  const raw = user.departmentIds as unknown;
  const list = Array.isArray(raw) ? raw : [];
  const departments = list
    .map((item) => serializeNamedRef(item))
    .filter((item): item is { id: string; name: string; slug: string | null } => Boolean(item?.id));
  return {
    departmentIds: departments.map((department) => department.id),
    departments,
  };
}

export type AllowedModuleSummary = {
  id: string;
  name: string;
  slug: string | null;
  departmentId: string | null;
};

export function serializeUser(
  user: UserDocument,
  extras?: { modules?: AllowedModuleSummary[] },
) {
  const isMember = String(user.role ?? '').toLowerCase() === 'user';
  const modules = extras?.modules ?? [];
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    access: isMember ? (user.access ?? MemberAccess.LEARNER) : null,
    tenantId: String(user.tenantId),
    ...departmentFields(user),
    moduleIds: modules.map((mod) => mod.id),
    modules,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
