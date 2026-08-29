import mongoose from 'mongoose';
import { MemberAccess, UserRole, RESERVED_TENANT_PATHS, slugifySegment } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';

const reserved = new Set<string>(RESERVED_TENANT_PATHS);
const DEPARTMENT_POPULATE = { path: 'departmentIds', select: 'name slug' } as const;

export const userRepository = {
  findByEmail(email: string) {
    return mongoRegistry.models.User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  },

  findByEmailOrUsername(identifier: string) {
    const clean = identifier.trim().toLowerCase();
    return mongoRegistry.models.User.findOne({
      $or: [{ email: clean }, { username: clean }],
    }).select('+passwordHash');
  },

  findById(id: string) {
    return mongoRegistry.models.User.findById(id).populate(DEPARTMENT_POPULATE);
  },

  findByTenant(tenantId: string) {
    return mongoRegistry.models.User.find({ tenantId })
      .populate(DEPARTMENT_POPULATE)
      .sort({ createdAt: -1 });
  },

  findByTutor(tenantId: string, tutorId: string) {
    return mongoRegistry.models.User.find({ tenantId, createdBy: tutorId, access: MemberAccess.LEARNER })
      .populate(DEPARTMENT_POPULATE)
      .sort({ createdAt: -1 });
  },

  findByTenantUsername(tenantId: string, username: string) {
    return mongoRegistry.models.User.findOne({
      tenantId,
      username: username.toLowerCase(),
    }).populate(DEPARTMENT_POPULATE);
  },

  countTenantAdmins(tenantId: string) {
    return mongoRegistry.models.User.countDocuments({
      tenantId,
      role: UserRole.TENANT,
    });
  },

  async allocateUsername(tenantId: string, name: string) {
    let base = slugifySegment(name, 'user');
    if (reserved.has(base)) {
      base = `user-${base}`;
    }

    let username = base;
    let attempt = 0;
    while (attempt < 12) {
      const existing = await mongoRegistry.models.User.exists({ tenantId, username });
      if (!existing) {
        return username;
      }
      attempt += 1;
      username = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    throw new Error('Failed to allocate a unique username');
  },

  async create(data: {
    email: string;
    name: string;
    passwordHash: string;
    tenantId: string;
    role?: UserRole;
    access?: MemberAccess;
    username?: string;
    departmentIds?: mongoose.Types.ObjectId[];
    createdBy?: string;
  }) {
    const username =
      data.username ?? (await userRepository.allocateUsername(data.tenantId, data.name));
    const user = await mongoRegistry.models.User.create({
      email: data.email,
      name: data.name,
      username,
      passwordHash: data.passwordHash,
      tenantId: data.tenantId,
      role: data.role ?? UserRole.USER,
      ...(data.access ? { access: data.access } : {}),
      departmentIds: data.departmentIds ?? [],
      ...(data.createdBy ? { createdBy: data.createdBy } : {}),
    });
    return user.populate(DEPARTMENT_POPULATE);
  },

  updateById(
    id: string,
    patch: Partial<{
      name: string;
      role: UserRole;
      access: MemberAccess;
      passwordHash: string;
      username: string;
      departmentIds: mongoose.Types.ObjectId[];
    }>,
  ) {
    return mongoRegistry.models.User.findByIdAndUpdate(id, patch, { new: true }).populate(
      DEPARTMENT_POPULATE,
    );
  },

  deleteById(id: string) {
    return mongoRegistry.models.User.findByIdAndDelete(id);
  },
};
