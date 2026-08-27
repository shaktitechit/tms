import mongoose, { type FilterQuery } from 'mongoose';
import { slugifySegment } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { ModuleDocument } from '../../models/index.js';

function isObjectIdString(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === value;
}

export const moduleRepository = {
  create(data: Partial<ModuleDocument>) {
    return mongoRegistry.models.Module.create(data);
  },

  findByTenant(tenantId: string, departmentId?: string) {
    const query: FilterQuery<ModuleDocument> = { tenantId };
    if (departmentId) {
      query.departmentId = departmentId;
    }
    return mongoRegistry.models.Module.find(query)
      .populate('departmentId', 'name slug')
      .sort({ name: 1 });
  },

  findById(id: string) {
    return mongoRegistry.models.Module.findById(id).populate('departmentId', 'name slug');
  },

  async findByRef(ref: string, tenantId: string) {
    if (isObjectIdString(ref)) {
      return mongoRegistry.models.Module.findOne({ _id: ref, tenantId }).populate(
        'departmentId',
        'name slug',
      );
    }
    return mongoRegistry.models.Module.findOne({ slug: ref, tenantId }).populate(
      'departmentId',
      'name slug',
    );
  },

  async allocateSlug(tenantId: string, name: string) {
    const base = slugifySegment(name, 'module');
    let slug = base;
    let attempt = 0;
    while (attempt < 12) {
      const existing = await mongoRegistry.models.Module.exists({ tenantId, slug });
      if (!existing) {
        return slug;
      }
      attempt += 1;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    throw new Error('Failed to allocate a unique module slug');
  },

  updateById(id: string, tenantId: string, patch: Partial<ModuleDocument>) {
    return mongoRegistry.models.Module.findOneAndUpdate({ _id: id, tenantId }, patch, {
      new: true,
    }).populate('departmentId', 'name slug');
  },

  deleteById(id: string, tenantId: string) {
    return mongoRegistry.models.Module.findOneAndDelete({ _id: id, tenantId });
  },

  count(query: FilterQuery<ModuleDocument>) {
    return mongoRegistry.models.Module.countDocuments(query);
  },
};
