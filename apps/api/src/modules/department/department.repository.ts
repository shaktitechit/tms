import mongoose, { type FilterQuery } from 'mongoose';
import { slugifySegment } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { DepartmentDocument } from '../../models/index.js';

function isObjectIdString(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === value;
}

export const departmentRepository = {
  create(data: Partial<DepartmentDocument>) {
    return mongoRegistry.models.Department.create(data);
  },

  findByTenant(tenantId: string) {
    return mongoRegistry.models.Department.find({ tenantId }).sort({ name: 1 });
  },

  findById(id: string) {
    return mongoRegistry.models.Department.findById(id);
  },

  async findByRef(ref: string, tenantId: string) {
    if (isObjectIdString(ref)) {
      return mongoRegistry.models.Department.findOne({ _id: ref, tenantId });
    }
    return mongoRegistry.models.Department.findOne({ slug: ref, tenantId });
  },

  async allocateSlug(tenantId: string, name: string) {
    const base = slugifySegment(name, 'department');
    let slug = base;
    let attempt = 0;
    while (attempt < 12) {
      const existing = await mongoRegistry.models.Department.exists({ tenantId, slug });
      if (!existing) {
        return slug;
      }
      attempt += 1;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    throw new Error('Failed to allocate a unique department slug');
  },

  updateById(id: string, tenantId: string, patch: Partial<DepartmentDocument>) {
    return mongoRegistry.models.Department.findOneAndUpdate({ _id: id, tenantId }, patch, {
      new: true,
    });
  },

  deleteById(id: string, tenantId: string) {
    return mongoRegistry.models.Department.findOneAndDelete({ _id: id, tenantId });
  },

  count(query: FilterQuery<DepartmentDocument>) {
    return mongoRegistry.models.Department.countDocuments(query);
  },
};
