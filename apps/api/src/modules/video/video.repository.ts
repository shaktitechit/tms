import mongoose, { type FilterQuery } from 'mongoose';
import { slugifySegment } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { VideoDocument } from '../../models/index.js';

function isObjectIdString(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === value;
}

const modulePopulate = {
  path: 'moduleId',
  select: 'name slug departmentId',
  populate: { path: 'departmentId', select: 'name slug' },
} as const;

const lessonPopulate = {
  path: 'lessonId',
  select: 'name slug',
} as const;

export const videoRepository = {
  create(data: Partial<VideoDocument> & { _id?: VideoDocument['_id'] }) {
    return mongoRegistry.models.Video.create(data);
  },

  find(query: FilterQuery<VideoDocument>) {
    return mongoRegistry.models.Video.find(query)
      .populate(modulePopulate)
      .populate(lessonPopulate)
      .sort({ createdAt: -1 });
  },

  findById(id: string) {
    return mongoRegistry.models.Video.findById(id)
      .populate(modulePopulate)
      .populate(lessonPopulate);
  },

  async findByRef(ref: string, tenantId?: string) {
    if (isObjectIdString(ref)) {
      return mongoRegistry.models.Video.findById(ref)
        .populate(modulePopulate)
        .populate(lessonPopulate);
    }
    if (tenantId) {
      return mongoRegistry.models.Video.findOne({ tenantId, slug: ref })
        .populate(modulePopulate)
        .populate(lessonPopulate);
    }
    return mongoRegistry.models.Video.findOne({ slug: ref })
      .populate(modulePopulate)
      .populate(lessonPopulate);
  },

  async allocateSlug(tenantId: string, title: string) {
    const base = slugifySegment(title, 'video');
    let slug = base;
    let attempt = 0;
    while (attempt < 12) {
      const existing = await mongoRegistry.models.Video.exists({ tenantId, slug });
      if (!existing) {
        return slug;
      }
      attempt += 1;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    throw new Error('Failed to allocate a unique video slug');
  },

  findBySlug(tenantId: string, slug: string) {
    return mongoRegistry.models.Video.findOne({ tenantId, slug })
      .populate(modulePopulate)
      .populate(lessonPopulate);
  },

  updateById(id: string, update: Partial<VideoDocument> | Record<string, unknown>) {
    return mongoRegistry.models.Video.findByIdAndUpdate(id, update, { new: true });
  },

  deleteById(id: string) {
    return mongoRegistry.models.Video.findByIdAndDelete(id);
  },
};
