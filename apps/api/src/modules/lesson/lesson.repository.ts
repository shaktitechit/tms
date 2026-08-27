import mongoose, { type FilterQuery } from 'mongoose';
import { slugifySegment } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { LessonDocument } from '../../models/index.js';

function isObjectIdString(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === value;
}

export const lessonRepository = {
  create(data: Partial<LessonDocument>) {
    return mongoRegistry.models.Lesson.create(data);
  },

  findByTenant(tenantId: string, moduleId?: string) {
    const query: FilterQuery<LessonDocument> = { tenantId };
    if (moduleId) {
      query.moduleId = moduleId;
    }
    return mongoRegistry.models.Lesson.find(query)
      .populate('moduleId', 'name slug')
      .sort({ serial: 1, createdAt: 1 });
  },

  async allocateSerial(tenantId: string, moduleId: mongoose.Types.ObjectId | string) {
    const last = await mongoRegistry.models.Lesson.findOne({ tenantId, moduleId })
      .sort({ serial: -1 })
      .select('serial')
      .lean();
    return (typeof last?.serial === 'number' && last.serial > 0 ? last.serial : 0) + 1;
  },

  findById(id: string) {
    return mongoRegistry.models.Lesson.findById(id).populate('moduleId', 'name slug');
  },

  async findByRef(ref: string, tenantId: string) {
    if (isObjectIdString(ref)) {
      return mongoRegistry.models.Lesson.findOne({ _id: ref, tenantId }).populate(
        'moduleId',
        'name slug',
      );
    }
    return mongoRegistry.models.Lesson.findOne({ slug: ref, tenantId }).populate(
      'moduleId',
      'name slug',
    );
  },

  async allocateSlug(tenantId: string, name: string) {
    const base = slugifySegment(name, 'lesson');
    let slug = base;
    let attempt = 0;
    while (attempt < 12) {
      const existing = await mongoRegistry.models.Lesson.exists({ tenantId, slug });
      if (!existing) {
        return slug;
      }
      attempt += 1;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    throw new Error('Failed to allocate a unique lesson slug');
  },

  updateById(id: string, tenantId: string, patch: Partial<LessonDocument>) {
    return mongoRegistry.models.Lesson.findOneAndUpdate({ _id: id, tenantId }, patch, {
      new: true,
    }).populate('moduleId', 'name slug');
  },

  deleteById(id: string, tenantId: string) {
    return mongoRegistry.models.Lesson.findOneAndDelete({ _id: id, tenantId });
  },

  count(query: FilterQuery<LessonDocument>) {
    return mongoRegistry.models.Lesson.countDocuments(query);
  },
};
