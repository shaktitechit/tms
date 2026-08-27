import mongoose from 'mongoose';
import { AppError, ERROR_CODES, UserRole } from '@video/shared';
import { forbidden, notFound } from '../../http/errors.js';
import { moduleRepository } from '../module/module.repository.js';
import { userRepository } from '../user/user.repository.js';
import { allowedModuleSummary, serializeMemberModule } from './member-module.serializer.js';
import { memberModuleRepository } from './member-module.repository.js';

type AuthActor = { id: string; role: string; tenantId: string };

export class MemberModuleService {
  async list(actor: AuthActor, userId: string) {
    if (!userId.trim()) {
      throw new AppError('userId is required', ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const member = await this.requireMember(actor, userId);
    this.assertCanView(actor, String(member._id));
    const rows = await memberModuleRepository.findByUser(actor.tenantId, String(member._id));
    return rows.map((row) => serializeMemberModule(row));
  }

  async getById(actor: AuthActor, id: string) {
    const row = await memberModuleRepository.findById(id);
    if (!row || String(row.tenantId) !== actor.tenantId) {
      throw notFound('Member module not found', ERROR_CODES.NOT_FOUND);
    }
    this.assertCanView(actor, String(row.userId));
    return serializeMemberModule(row);
  }

  async create(actor: AuthActor, input: { userId: string; moduleId: string }) {
    this.assertTenantAdmin(actor);
    const member = await this.requireMember(actor, input.userId);
    const resolved = await this.resolveAllowedModule(actor.tenantId, member, input.moduleId);
    const existing = await memberModuleRepository.findOne(
      actor.tenantId,
      String(member._id),
      String(resolved.moduleId),
    );
    if (existing) {
      return serializeMemberModule(existing);
    }
    const created = await memberModuleRepository.create({
      userId: member._id,
      moduleId: resolved.moduleId,
      departmentId: resolved.departmentId ?? undefined,
      tenantId: new mongoose.Types.ObjectId(actor.tenantId),
    });
    await created.populate({ path: 'moduleId', select: 'name slug departmentId' });
    return serializeMemberModule(created);
  }

  async replace(actor: AuthActor, input: { userId: string; moduleIds: string[] }) {
    this.assertTenantAdmin(actor);
    const member = await this.requireMember(actor, input.userId);
    const resolved = await this.resolveAllowedModules(actor.tenantId, member, input.moduleIds);
    await memberModuleRepository.deleteByUser(actor.tenantId, String(member._id));
    const rows = await memberModuleRepository.insertMany(
      resolved.map((item) => ({
        userId: member._id,
        moduleId: item.moduleId,
        departmentId: item.departmentId,
        tenantId: new mongoose.Types.ObjectId(actor.tenantId),
      })),
    );
    return rows.map((row) => serializeMemberModule(row));
  }

  async remove(actor: AuthActor, id: string) {
    this.assertTenantAdmin(actor);
    const existing = await memberModuleRepository.findById(id);
    if (!existing || String(existing.tenantId) !== actor.tenantId) {
      throw notFound('Member module not found', ERROR_CODES.NOT_FOUND);
    }
    await memberModuleRepository.deleteById(id, actor.tenantId);
    return { deleted: true };
  }

  async modulesForUsers(tenantId: string, userIds: string[]) {
    const rows = await memberModuleRepository.findByUserIds(tenantId, userIds);
    const byUser = new Map<string, ReturnType<typeof allowedModuleSummary>[]>();
    for (const row of rows) {
      const userId = String(row.userId);
      const list = byUser.get(userId) ?? [];
      const summary = allowedModuleSummary(row);
      if (summary.id) {
        list.push(summary);
      }
      byUser.set(userId, list);
    }
    return byUser;
  }

  async pruneForDepartments(
    tenantId: string,
    userId: string,
    departmentIds: mongoose.Types.ObjectId[],
  ) {
    if (departmentIds.length === 0) {
      await memberModuleRepository.deleteByUser(tenantId, userId);
      return;
    }
    const allowed = new Set(departmentIds.map((id) => String(id)));
    const rows = await memberModuleRepository.findByUser(tenantId, userId);
    const staleIds = rows
      .filter((row) => {
        const departmentId = this.moduleDepartmentId(row.moduleId) ?? (row.departmentId ? String(row.departmentId) : null);
        return !departmentId || !allowed.has(departmentId);
      })
      .map((row) => String(row._id));
    await Promise.all(staleIds.map((id) => memberModuleRepository.deleteById(id, tenantId)));
  }

  async deleteByUser(tenantId: string, userId: string) {
    await memberModuleRepository.deleteByUser(tenantId, userId);
  }

  async deleteByModuleId(tenantId: string, moduleId: string) {
    await memberModuleRepository.deleteByModuleId(tenantId, moduleId);
  }

  async deleteByModuleIds(tenantId: string, moduleIds: mongoose.Types.ObjectId[]) {
    await memberModuleRepository.deleteByModuleIds(tenantId, moduleIds);
  }

  private async requireMember(actor: AuthActor, userId: string) {
    const user = await userRepository.findById(userId);
    if (!user || String(user.tenantId) !== actor.tenantId) {
      throw notFound('User not found', ERROR_CODES.NOT_FOUND);
    }
    if (user.role !== UserRole.USER) {
      throw new AppError(
        'Only member users can be assigned modules',
        ERROR_CODES.FORBIDDEN,
        403,
      );
    }
    return user;
  }

  private async resolveAllowedModule(
    tenantId: string,
    member: { departmentIds?: unknown },
    moduleRef: string,
  ) {
    const [resolved] = await this.resolveAllowedModules(tenantId, member, [moduleRef]);
    if (!resolved) {
      throw notFound('Module not found', ERROR_CODES.NOT_FOUND);
    }
    return resolved;
  }

  private async resolveAllowedModules(
    tenantId: string,
    member: { departmentIds?: unknown },
    refs: string[],
  ) {
    const uniqueRefs = [...new Set(refs.map((ref) => ref.trim()).filter(Boolean))];
    const allowedDepartments = new Set(
      (Array.isArray(member.departmentIds) ? member.departmentIds : [])
        .map((item) => this.refId(item))
        .filter((id): id is string => Boolean(id)),
    );
    const resolved: Array<{
      moduleId: mongoose.Types.ObjectId;
      departmentId: mongoose.Types.ObjectId | null;
    }> = [];
    for (const ref of uniqueRefs) {
      const mod = await moduleRepository.findByRef(ref, tenantId);
      if (!mod) {
        throw notFound('Module not found', ERROR_CODES.NOT_FOUND);
      }
      const departmentId = this.refId(mod.departmentId);
      if (!departmentId || !allowedDepartments.has(departmentId)) {
        throw new AppError(
          'Module is not in an assigned department',
          ERROR_CODES.FORBIDDEN,
          403,
        );
      }
      resolved.push({
        moduleId: mod._id,
        departmentId: departmentId ? new mongoose.Types.ObjectId(departmentId) : null,
      });
    }
    return resolved;
  }

  private moduleDepartmentId(raw: unknown) {
    if (!raw) {
      return null;
    }
    if (typeof raw === 'object' && raw !== null && 'departmentId' in raw) {
      return this.refId((raw as { departmentId?: unknown }).departmentId);
    }
    return null;
  }

  private refId(raw: unknown) {
    if (!raw) {
      return null;
    }
    if (typeof raw === 'object' && raw !== null && '_id' in raw) {
      return String((raw as { _id: unknown })._id);
    }
    return String(raw);
  }

  private assertCanView(actor: AuthActor, userId: string) {
    if (actor.role === UserRole.TENANT || actor.id === userId) {
      return;
    }
    throw forbidden();
  }

  private assertTenantAdmin(actor: AuthActor) {
    if (actor.role !== UserRole.TENANT) {
      throw forbidden();
    }
  }
}
