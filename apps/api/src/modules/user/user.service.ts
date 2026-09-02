import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { AppError, ERROR_CODES, MemberAccess, UserRole } from '@video/shared';
import { isObjectIdString } from '../content/content.utils.js';
import { isTutorActor } from '../../http/access.js';
import { forbidden, notFound } from '../../http/errors.js';
import { departmentRepository } from '../department/department.repository.js';
import { MemberModuleService } from '../member-module/member-module.service.js';
import { buildMemberProgress } from './user-progress.service.js';
import { departmentObjectIds, serializeUser, sharesDepartment } from './user.serializer.js';
import { userRepository } from './user.repository.js';
import type { UserDocument } from '../../models/index.js';

const SALT_ROUNDS = 12;

type AuthActor = { id: string; role: string; tenantId: string; access?: string | null };

type UserPatch = {
  name?: string;
  password?: string;
  role?: UserRole;
  access?: MemberAccess;
  departmentIds?: string[];
};

export class UserService {
  private readonly memberModules = new MemberModuleService();

  async list(actor: AuthActor) {
    const users = await userRepository.findByTenant(actor.tenantId);
    return this.withModules(actor.tenantId, users);
  }

  async listByTutor(actor: AuthActor) {
    if (!isTutorActor(actor)) {
      throw forbidden();
    }
    const tutor = await this.requireActorUser(actor);
    const users = await userRepository.findLearnersByDepartments(
      actor.tenantId,
      departmentObjectIds(tutor),
    );
    return this.withModules(actor.tenantId, users);
  }

  async getById(actor: AuthActor, id: string) {
    const user = await this.requireInTenant(actor.tenantId, id);
    const [serialized] = await this.withModules(actor.tenantId, [user]);
    return serialized;
  }

  async getProgress(actor: AuthActor, ref: string) {
    const user = await this.requireInTenant(actor.tenantId, ref);
    const isSelf = actor.id === String(user._id);
    const isTenantAdmin = actor.role === UserRole.TENANT;
    if (!isSelf && !isTenantAdmin) {
      if (!isTutorActor(actor)) {
        throw forbidden();
      }
      const tutor = await this.requireActorUser(actor);
      if (!sharesDepartment(tutor, user)) {
        throw forbidden();
      }
    }
    const serializedUsers = await this.withModules(actor.tenantId, [user]);
    const serialized = serializedUsers[0];
    if (!serialized) {
      throw notFound('User not found', ERROR_CODES.NOT_FOUND);
    }
    const progress = await buildMemberProgress(actor.tenantId, serialized);
    return { user: serialized, ...progress };
  }

  async create(
    actor: AuthActor,
    input: {
      email: string;
      password: string;
      name: string;
      role?: UserRole;
      access?: MemberAccess;
      departmentIds?: string[];
    },
  ) {
    if (actor.role !== UserRole.TENANT) {
      throw forbidden();
    }

    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError('Email is already registered', ERROR_CODES.EMAIL_IN_USE, 409);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const role = input.role ?? UserRole.USER;
    const departmentIds = await this.resolveDepartmentIds(actor.tenantId, input.departmentIds);
    const user = await userRepository.create({
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash,
      tenantId: actor.tenantId,
      role,
      access: role === UserRole.USER ? (input.access ?? MemberAccess.LEARNER) : undefined,
      departmentIds,
    });

    const [serialized] = await this.withModules(actor.tenantId, [user]);
    return serialized;
  }

  /** Tutors can create learner accounts in their assigned departments. */
  async createLearner(
    actor: AuthActor,
    input: {
      email: string;
      password: string;
      name: string;
      departmentIds?: string[];
    },
  ) {
    const isTutor = isTutorActor(actor);
    const isTenantAdmin = actor.role === UserRole.TENANT;
    if (!isTutor && !isTenantAdmin) {
      throw forbidden();
    }

    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError('Email is already registered', ERROR_CODES.EMAIL_IN_USE, 409);
    }

    let departmentIds: mongoose.Types.ObjectId[] = [];
    if (isTutor) {
      const tutor = await this.requireActorUser(actor);
      departmentIds =
        input.departmentIds !== undefined
          ? await this.resolveTutorDepartmentIds(actor.tenantId, tutor, input.departmentIds)
          : departmentObjectIds(tutor);
    } else if (input.departmentIds !== undefined) {
      departmentIds = await this.resolveDepartmentIds(actor.tenantId, input.departmentIds);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await userRepository.create({
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash,
      tenantId: actor.tenantId,
      role: UserRole.USER,
      access: MemberAccess.LEARNER,
      departmentIds,
      createdBy: actor.id,
    });

    const [serialized] = await this.withModules(actor.tenantId, [user]);
    return serialized;
  }

  async update(actor: AuthActor, id: string, patch: UserPatch) {
    const user = await userRepository.findById(id);
    if (!user || String(user.tenantId) !== actor.tenantId) {
      throw notFound('User not found', ERROR_CODES.NOT_FOUND);
    }

    const isSelf = actor.id === String(user._id);
    const isTenantAdmin = actor.role === UserRole.TENANT;
    const tutor = isTutorActor(actor) ? await this.requireActorUser(actor) : null;
    const tutorManagesLearner = Boolean(
      tutor && !isSelf && this.tutorCanManageLearner(tutor, user),
    );

    if (!isSelf && !isTenantAdmin && !tutorManagesLearner) {
      throw forbidden();
    }

    if (patch.role !== undefined) {
      if (!isTenantAdmin) {
        throw forbidden('Only tenant admins can change roles');
      }
      if (user.role === UserRole.TENANT && patch.role !== UserRole.TENANT) {
        const adminCount = await userRepository.countTenantAdmins(actor.tenantId);
        if (adminCount <= 1) {
          throw new AppError(
            'Cannot demote the last tenant admin',
            ERROR_CODES.FORBIDDEN,
            403,
          );
        }
      }
    }

    if (patch.password !== undefined && !isSelf && !isTenantAdmin && !tutorManagesLearner) {
      throw forbidden();
    }

    if (patch.departmentIds !== undefined && !isTenantAdmin && !tutorManagesLearner) {
      throw forbidden('Only tenant admins can change departments');
    }

    if (patch.access !== undefined && !isTenantAdmin) {
      throw forbidden('Only tenant admins can change access');
    }

    const updates: Partial<{
      name: string;
      role: UserRole;
      access: MemberAccess;
      passwordHash: string;
      departmentIds: mongoose.Types.ObjectId[];
    }> = {};
    if (patch.name !== undefined) {
      updates.name = patch.name;
    }
    if (patch.role !== undefined) {
      updates.role = patch.role;
    }
    if (patch.password !== undefined) {
      updates.passwordHash = await bcrypt.hash(patch.password, SALT_ROUNDS);
    }
    if (patch.departmentIds !== undefined) {
      if (tutorManagesLearner && tutor) {
        updates.departmentIds = this.mergeTutorDepartmentIds(
          tutor,
          user,
          await this.resolveTutorDepartmentIds(actor.tenantId, tutor, patch.departmentIds),
        );
      } else {
        updates.departmentIds = await this.resolveDepartmentIds(actor.tenantId, patch.departmentIds);
      }
    }
    if (patch.access !== undefined) {
      const nextRole = patch.role ?? user.role;
      if (nextRole === UserRole.USER) {
        updates.access = patch.access;
      }
    }

    const updated = await userRepository.updateById(id, updates);
    if (!updated) {
      throw notFound('User not found', ERROR_CODES.NOT_FOUND);
    }

    const nextRole = updates.role ?? user.role;
    const nextAccess = updates.access ?? user.access;
    if (nextRole === UserRole.USER && nextAccess === MemberAccess.TUTOR) {
      await this.memberModules.deleteByUser(actor.tenantId, id);
    } else if (patch.departmentIds !== undefined) {
      await this.memberModules.pruneForDepartments(
        actor.tenantId,
        id,
        updates.departmentIds ?? [],
      );
    }

    const [serialized] = await this.withModules(actor.tenantId, [updated]);
    return serialized;
  }

  async remove(actor: AuthActor, id: string) {
    if (actor.role !== UserRole.TENANT) {
      throw forbidden();
    }
    if (actor.id === id) {
      throw forbidden('You cannot delete your own account');
    }

    const user = await userRepository.findById(id);
    if (!user || String(user.tenantId) !== actor.tenantId) {
      throw notFound('User not found', ERROR_CODES.NOT_FOUND);
    }

    if (user.role === UserRole.TENANT) {
      const adminCount = await userRepository.countTenantAdmins(actor.tenantId);
      if (adminCount <= 1) {
        throw new AppError(
          'Cannot delete the last tenant admin',
          ERROR_CODES.FORBIDDEN,
          403,
        );
      }
    }

    await this.memberModules.deleteByUser(actor.tenantId, id);
    await userRepository.deleteById(id);
    return { deleted: true };
  }

  private async withModules(tenantId: string, users: UserDocument[]) {
    const modulesByUser = await this.memberModules.modulesForUsers(
      tenantId,
      users.map((user) => String(user._id)),
    );
    return users.map((user) =>
      serializeUser(user, { modules: modulesByUser.get(String(user._id)) ?? [] }),
    );
  }

  private async requireActorUser(actor: AuthActor) {
    const user = await userRepository.findById(actor.id);
    if (!user || String(user.tenantId) !== actor.tenantId) {
      throw notFound('User not found', ERROR_CODES.NOT_FOUND);
    }
    return user;
  }

  private async requireInTenant(tenantId: string, ref: string) {
    let user = null;
    if (isObjectIdString(ref)) {
      user = await userRepository.findById(ref);
      if (user && String(user.tenantId) !== tenantId) {
        user = null;
      }
    }
    if (!user) {
      user = await userRepository.findByTenantUsername(tenantId, ref);
    }
    if (!user) {
      throw notFound('User not found', ERROR_CODES.NOT_FOUND);
    }
    return user;
  }

  private tutorCanManageLearner(tutor: UserDocument, learner: UserDocument) {
    return (
      learner.role === UserRole.USER &&
      learner.access !== MemberAccess.TUTOR &&
      sharesDepartment(tutor, learner)
    );
  }

  private async resolveTutorDepartmentIds(
    tenantId: string,
    tutor: UserDocument,
    refs?: string[],
  ) {
    const departmentIds = await this.resolveDepartmentIds(tenantId, refs);
    const allowed = new Set(departmentObjectIds(tutor).map(String));
    if (departmentIds.some((id) => !allowed.has(String(id)))) {
      throw forbidden('You can only assign your assigned departments');
    }
    return departmentIds;
  }

  private mergeTutorDepartmentIds(
    tutor: UserDocument,
    learner: UserDocument,
    nextTutorDepartments: mongoose.Types.ObjectId[],
  ) {
    const tutorSet = new Set(departmentObjectIds(tutor).map(String));
    const kept = departmentObjectIds(learner).filter((id) => !tutorSet.has(String(id)));
    return [...kept, ...nextTutorDepartments];
  }

  private async resolveDepartmentIds(tenantId: string, refs?: string[]) {
    const uniqueRefs = [...new Set((refs ?? []).map((ref) => ref.trim()).filter(Boolean))];
    const departmentIds: mongoose.Types.ObjectId[] = [];
    for (const ref of uniqueRefs) {
      const department = await departmentRepository.findByRef(ref, tenantId);
      if (!department) {
        throw notFound('Department not found', ERROR_CODES.NOT_FOUND);
      }
      departmentIds.push(department._id);
    }
    return departmentIds;
  }
}
