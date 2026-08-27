import mongoose, { type HydratedDocument } from 'mongoose';
import { ContentSeenStatus, ERROR_CODES, MemberAccess, UserRole } from '@video/shared';
import { forbidden, notFound } from '../../http/errors.js';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { ModuleDocument } from '../../models/index.js';
import type { AppContext } from '../../types.js';
import { departmentRepository } from '../department/department.repository.js';
import { cascadeDeleteLessonContent } from '../content/lesson-content.cascade.js';
import { refId } from '../content/content.utils.js';
import { summarizeLessonsForActor } from '../lesson/lesson-content-summary.js';
import { serializeLesson } from '../lesson/lesson.serializer.js';
import { memberModuleRepository } from '../member-module/member-module.repository.js';
import { userRepository } from '../user/user.repository.js';
import type { ParsedModuleForm, ParsedModuleImage } from './module.form.parser.js';
import { thumbnailExtension } from './module.form.parser.js';
import { serializeModule } from './module.serializer.js';
import { moduleRepository } from './module.repository.js';

type AuthActor = {
  id: string;
  role: string;
  tenantId: string;
  access?: string | null;
  name?: string;
  email?: string;
};

type ModuleEntity = HydratedDocument<ModuleDocument>;

export class ModuleService {
  constructor(private readonly ctx: AppContext) {}

  async list(actor: AuthActor, options?: { department?: string }) {
    let departmentId: string | undefined;
    if (options?.department) {
      departmentId = String(await this.resolveDepartmentId(actor.tenantId, options.department));
    }
    const modules = await moduleRepository.findByTenant(actor.tenantId, departmentId);
    return Promise.all(
      modules.map(async (mod) => {
        const serialized = await this.ensureAuthor(mod);
        const lessonCount = await mongoRegistry.models.Lesson.countDocuments({
          tenantId: actor.tenantId,
          moduleId: mod._id,
        });
        return { ...serialized, lessonCount };
      }),
    );
  }

  async getById(actor: AuthActor, ref: string) {
    const mod = await this.requireModule(actor, ref);
    await mod.populate('departmentId', 'name slug');
    const serialized = await this.ensureAuthor(mod);
    const lessons = await mongoRegistry.models.Lesson.find({
      tenantId: actor.tenantId,
      moduleId: mod._id,
    })
      .populate('moduleId', 'name slug')
      .sort({ serial: 1, createdAt: 1 });

    const summaries = await summarizeLessonsForActor(
      actor,
      lessons.map((lesson) => lesson._id),
    );

    return {
      ...serialized,
      lessonCount: lessons.length,
      lessons: lessons.map((lesson) => {
        const summary = summaries.get(String(lesson._id));
        return {
          ...serializeLesson(lesson),
          duration: summary?.duration ?? 0,
          completedPercent: summary?.completedPercent ?? 0,
          seenStatus: summary?.seenStatus ?? ContentSeenStatus.PENDING,
        };
      }),
    };
  }

  async create(
    actor: AuthActor,
    input: {
      name: string;
      description?: string;
      authorName: string;
      authorEmail: string;
      departmentId?: string | null;
    },
    thumbnail?: ParsedModuleImage,
  ) {
    await this.assertCanCreate(actor, input.departmentId ?? undefined);

    const moduleId = new mongoose.Types.ObjectId();
    const slug = await moduleRepository.allocateSlug(actor.tenantId, input.name.trim());
    let thumbnailStorageKey: string | undefined;
    const departmentId = await this.resolveDepartmentId(actor.tenantId, input.departmentId ?? undefined);

    if (thumbnail) {
      thumbnailStorageKey = await this.uploadThumbnail(String(moduleId), thumbnail);
    }

    const mod = await moduleRepository.create({
      _id: moduleId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() ?? '',
      thumbnailStorageKey,
      authorName: input.authorName.trim(),
      authorEmail: input.authorEmail.trim().toLowerCase(),
      departmentId,
      createdBy: new mongoose.Types.ObjectId(actor.id),
      tenantId: new mongoose.Types.ObjectId(actor.tenantId),
    });

    await mod.populate('departmentId', 'name slug');
    await this.assignModuleToCreator(actor, moduleId, departmentId);
    return serializeModule(mod);
  }

  async createFromForm(actor: AuthActor, form: ParsedModuleForm) {
    return this.create(
      actor,
      {
        name: form.name,
        description: form.description,
        authorName: form.authorName,
        authorEmail: form.authorEmail,
        departmentId: form.departmentId,
      },
      form.thumbnail,
    );
  }

  async update(
    actor: AuthActor,
    ref: string,
    patch: {
      name?: string;
      description?: string;
      authorName?: string;
      authorEmail?: string;
      departmentId?: string | null;
    },
    thumbnail?: ParsedModuleImage,
  ) {
    const existing = await this.requireModule(actor, ref);
    const departmentRef =
      patch.departmentId !== undefined ? patch.departmentId : refId(existing.departmentId);
    await this.assertCanCreate(actor, departmentRef);

    const updates: {
      name?: string;
      description?: string;
      authorName?: string;
      authorEmail?: string;
      thumbnailStorageKey?: string;
      departmentId?: mongoose.Types.ObjectId | null;
    } = {};
    if (patch.name !== undefined) {
      updates.name = patch.name.trim();
    }
    if (patch.description !== undefined) {
      updates.description = patch.description.trim();
    }
    if (patch.authorName !== undefined) {
      updates.authorName = patch.authorName.trim();
    }
    if (patch.authorEmail !== undefined) {
      updates.authorEmail = patch.authorEmail.trim().toLowerCase();
    }
    if (patch.departmentId !== undefined) {
      if (patch.departmentId === null) {
        updates.departmentId = null;
      } else {
        updates.departmentId = await this.resolveDepartmentId(actor.tenantId, patch.departmentId);
      }
    }
    if (thumbnail) {
      updates.thumbnailStorageKey = await this.uploadThumbnail(String(existing._id), thumbnail);
    }

    const updated = await moduleRepository.updateById(
      String(existing._id),
      actor.tenantId,
      updates as Partial<ModuleDocument>,
    );
    if (!updated) {
      throw notFound('Module not found', ERROR_CODES.NOT_FOUND);
    }
    await updated.populate('departmentId', 'name slug');
    return serializeModule(updated);
  }

  async updateFromForm(actor: AuthActor, ref: string, form: ParsedModuleForm) {
    return this.update(
      actor,
      ref,
      {
        name: form.name,
        description: form.description,
        authorName: form.authorName,
        authorEmail: form.authorEmail,
        departmentId: form.departmentId ?? null,
      },
      form.thumbnail,
    );
  }

  async remove(actor: AuthActor, ref: string) {
    this.assertTenantAdmin(actor);
    const existing = await this.requireModule(actor, ref);

    const lessons = await mongoRegistry.models.Lesson.find({
      tenantId: actor.tenantId,
      moduleId: existing._id,
    }).select('_id');
    for (const lesson of lessons) {
      await cascadeDeleteLessonContent(this.ctx, String(lesson._id), actor.tenantId);
      await this.ctx.storage.deletePrefix(`lessons/${String(lesson._id)}/`);
    }
    await mongoRegistry.models.Lesson.deleteMany({
      tenantId: actor.tenantId,
      moduleId: existing._id,
    });

    await mongoRegistry.models.MemberModule.deleteMany({
      tenantId: actor.tenantId,
      moduleId: existing._id,
    });

    await this.ctx.storage.deletePrefix(`modules/${String(existing._id)}/`);
    await moduleRepository.deleteById(String(existing._id), actor.tenantId);
    return { deleted: true };
  }

  async pipeThumbnail(actor: AuthActor, ref: string, res: import('express').Response) {
    const mod = await this.requireModule(actor, ref);
    if (!mod.thumbnailStorageKey) {
      throw notFound('Thumbnail not found', ERROR_CODES.NOT_FOUND);
    }

    const exists = await this.ctx.storage.exists(mod.thumbnailStorageKey);
    if (!exists) {
      throw notFound('Thumbnail not found', ERROR_CODES.NOT_FOUND);
    }

    const metadata = await this.ctx.storage.getMetadata(mod.thumbnailStorageKey);
    res.setHeader('Content-Type', metadata.contentType ?? 'image/jpeg');
    if (metadata.contentLength) {
      res.setHeader('Content-Length', String(metadata.contentLength));
    }
    res.setHeader('Cache-Control', 'private, max-age=86400');

    const body = await this.ctx.storage.download(mod.thumbnailStorageKey);
    body.pipe(res);
  }

  private async uploadThumbnail(moduleId: string, file: ParsedModuleImage) {
    const key = `modules/${moduleId}/thumbnail${thumbnailExtension(file.mimeType)}`;
    await this.ctx.storage.upload(key, file.stream, {
      contentType: file.mimeType,
      contentLength: file.size > 0 ? file.size : undefined,
    });
    return key;
  }

  private async requireModule(actor: AuthActor, ref: string) {
    const mod = await moduleRepository.findByRef(ref, actor.tenantId);
    if (!mod) {
      throw notFound('Module not found', ERROR_CODES.NOT_FOUND);
    }
    if (!mod.slug) {
      mod.slug = await moduleRepository.allocateSlug(actor.tenantId, mod.name);
      await mod.save();
    }
    return mod;
  }

  private async resolveDepartmentId(tenantId: string, departmentRef?: string | null) {
    const ref = departmentRef?.trim();
    if (!ref) {
      return undefined;
    }
    const department = await departmentRepository.findByRef(ref, tenantId);
    if (!department) {
      throw notFound('Department not found', ERROR_CODES.NOT_FOUND);
    }
    return department._id;
  }

  private async ensureAuthor(mod: ModuleEntity) {
    if (mod.authorName && mod.authorEmail) {
      return serializeModule(mod);
    }

    if (mod.createdBy) {
      const user = await mongoRegistry.models.User.findById(mod.createdBy).lean();
      if (user) {
        mod.authorName = user.name;
        mod.authorEmail = user.email;
        await mod.save();
      }
    }

    return serializeModule({
      ...mod.toObject(),
      authorName: mod.authorName ?? 'Unknown',
      authorEmail: mod.authorEmail ?? '',
    } as ModuleDocument);
  }

  private async assignModuleToCreator(
    actor: AuthActor,
    moduleId: mongoose.Types.ObjectId,
    departmentId?: mongoose.Types.ObjectId,
  ) {
    if (actor.role !== UserRole.USER) {
      return;
    }
    const existing = await memberModuleRepository.findOne(
      actor.tenantId,
      actor.id,
      String(moduleId),
    );
    if (existing) {
      return;
    }
    await memberModuleRepository.create({
      userId: new mongoose.Types.ObjectId(actor.id),
      moduleId,
      departmentId,
      tenantId: new mongoose.Types.ObjectId(actor.tenantId),
    });
  }

  private async assertCanCreate(actor: AuthActor, departmentRef?: string | null) {
    if (actor.role === UserRole.TENANT) {
      return;
    }
    if (actor.role !== UserRole.USER || actor.access !== MemberAccess.TUTOR) {
      throw forbidden();
    }
    if (!departmentRef) {
      throw forbidden();
    }
    const member = await userRepository.findById(actor.id);
    if (!member || String(member.tenantId) !== actor.tenantId) {
      throw forbidden();
    }
    const departmentId = String(await this.resolveDepartmentId(actor.tenantId, departmentRef));
    const assigned = (Array.isArray(member.departmentIds) ? member.departmentIds : []).some(
      (item) => {
        if (!item) {
          return false;
        }
        if (typeof item === 'object' && item !== null && '_id' in item) {
          return String((item as { _id: unknown })._id) === departmentId;
        }
        return String(item) === departmentId;
      },
    );
    if (!assigned) {
      throw forbidden();
    }
  }

  private assertTenantAdmin(actor: AuthActor) {
    if (actor.role !== UserRole.TENANT) {
      throw forbidden();
    }
  }
}
