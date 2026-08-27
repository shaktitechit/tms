import mongoose from 'mongoose';
import { ERROR_CODES, UserRole } from '@video/shared';
import { forbidden, notFound } from '../../http/errors.js';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { AppContext } from '../../types.js';
import { serializeModule } from '../module/module.serializer.js';
import type { ParsedDepartmentForm, ParsedDepartmentImage } from './department.form.parser.js';
import { thumbnailExtension } from './department.form.parser.js';
import { departmentRepository } from './department.repository.js';
import { serializeDepartment } from './department.serializer.js';

type AuthActor = {
  id: string;
  role: string;
  tenantId: string;
};

export class DepartmentService {
  constructor(private readonly ctx: AppContext) {}

  async list(actor: AuthActor) {
    const departments = await departmentRepository.findByTenant(actor.tenantId);
    return Promise.all(
      departments.map(async (department) => {
        const moduleCount = await mongoRegistry.models.Module.countDocuments({
          tenantId: actor.tenantId,
          departmentId: department._id,
        });
        return serializeDepartment(department, { moduleCount });
      }),
    );
  }

  async getById(actor: AuthActor, ref: string) {
    const department = await this.requireDepartment(actor, ref);
    const modules = await mongoRegistry.models.Module.find({
      tenantId: actor.tenantId,
      departmentId: department._id,
    }).sort({ name: 1 });

    return serializeDepartment(department, {
      moduleCount: modules.length,
      modules: modules.map((mod) => serializeModule(mod)),
    });
  }

  async create(
    actor: AuthActor,
    input: { name: string; description?: string },
    thumbnail?: ParsedDepartmentImage,
  ) {
    this.assertTenantAdmin(actor);

    const departmentId = new mongoose.Types.ObjectId();
    const slug = await departmentRepository.allocateSlug(actor.tenantId, input.name.trim());
    let thumbnailStorageKey: string | undefined;

    if (thumbnail) {
      thumbnailStorageKey = await this.uploadThumbnail(String(departmentId), thumbnail);
    }

    const department = await departmentRepository.create({
      _id: departmentId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() ?? '',
      thumbnailStorageKey,
      createdBy: new mongoose.Types.ObjectId(actor.id),
      tenantId: new mongoose.Types.ObjectId(actor.tenantId),
    });

    return serializeDepartment(department, { moduleCount: 0, modules: [] });
  }

  async createFromForm(actor: AuthActor, form: ParsedDepartmentForm) {
    return this.create(
      actor,
      {
        name: form.name,
        description: form.description,
      },
      form.thumbnail,
    );
  }

  async update(
    actor: AuthActor,
    ref: string,
    patch: { name?: string; description?: string },
    thumbnail?: ParsedDepartmentImage,
  ) {
    this.assertTenantAdmin(actor);
    const existing = await this.requireDepartment(actor, ref);

    const updates: {
      name?: string;
      description?: string;
      thumbnailStorageKey?: string;
    } = {};
    if (patch.name !== undefined) {
      updates.name = patch.name.trim();
    }
    if (patch.description !== undefined) {
      updates.description = patch.description.trim();
    }
    if (thumbnail) {
      updates.thumbnailStorageKey = await this.uploadThumbnail(String(existing._id), thumbnail);
    }

    const updated = await departmentRepository.updateById(
      String(existing._id),
      actor.tenantId,
      updates,
    );
    if (!updated) {
      throw notFound('Department not found', ERROR_CODES.NOT_FOUND);
    }

    const moduleCount = await mongoRegistry.models.Module.countDocuments({
      tenantId: actor.tenantId,
      departmentId: updated._id,
    });
    return serializeDepartment(updated, { moduleCount });
  }

  async updateFromForm(actor: AuthActor, ref: string, form: ParsedDepartmentForm) {
    return this.update(
      actor,
      ref,
      {
        name: form.name,
        description: form.description,
      },
      form.thumbnail,
    );
  }

  async remove(actor: AuthActor, ref: string) {
    this.assertTenantAdmin(actor);
    const existing = await this.requireDepartment(actor, ref);

    const departmentModules = await mongoRegistry.models.Module.find({
      tenantId: actor.tenantId,
      departmentId: existing._id,
    }).select('_id');
    const departmentModuleIds = departmentModules.map((mod) => mod._id);
    if (departmentModuleIds.length > 0) {
      await mongoRegistry.models.MemberModule.deleteMany({
        tenantId: actor.tenantId,
        moduleId: { $in: departmentModuleIds },
      });
    }

    await mongoRegistry.models.Module.updateMany(
      { tenantId: actor.tenantId, departmentId: existing._id },
      { $unset: { departmentId: 1 } },
    );
    await mongoRegistry.models.User.updateMany(
      { tenantId: actor.tenantId, departmentIds: existing._id },
      { $pull: { departmentIds: existing._id } },
    );
    await this.ctx.storage.deletePrefix(`departments/${String(existing._id)}/`);
    await departmentRepository.deleteById(String(existing._id), actor.tenantId);
    return { deleted: true };
  }

  async pipeThumbnail(actor: AuthActor, ref: string, res: import('express').Response) {
    const department = await this.requireDepartment(actor, ref);
    if (!department.thumbnailStorageKey) {
      throw notFound('Thumbnail not found', ERROR_CODES.NOT_FOUND);
    }

    const exists = await this.ctx.storage.exists(department.thumbnailStorageKey);
    if (!exists) {
      throw notFound('Thumbnail not found', ERROR_CODES.NOT_FOUND);
    }

    const metadata = await this.ctx.storage.getMetadata(department.thumbnailStorageKey);
    res.setHeader('Content-Type', metadata.contentType ?? 'image/jpeg');
    if (metadata.contentLength) {
      res.setHeader('Content-Length', String(metadata.contentLength));
    }
    res.setHeader('Cache-Control', 'private, max-age=86400');

    const body = await this.ctx.storage.download(department.thumbnailStorageKey);
    body.pipe(res);
  }

  private async uploadThumbnail(departmentId: string, file: ParsedDepartmentImage) {
    const key = `departments/${departmentId}/thumbnail${thumbnailExtension(file.mimeType)}`;
    await this.ctx.storage.upload(key, file.stream, {
      contentType: file.mimeType,
      contentLength: file.size > 0 ? file.size : undefined,
    });
    return key;
  }

  private async requireDepartment(actor: AuthActor, ref: string) {
    const department = await departmentRepository.findByRef(ref, actor.tenantId);
    if (!department) {
      throw notFound('Department not found', ERROR_CODES.NOT_FOUND);
    }
    if (!department.slug) {
      department.slug = await departmentRepository.allocateSlug(actor.tenantId, department.name);
      await department.save();
    }
    return department;
  }

  private assertTenantAdmin(actor: AuthActor) {
    if (actor.role !== UserRole.TENANT) {
      throw forbidden();
    }
  }
}
