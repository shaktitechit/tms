import type { FilterQuery } from 'mongoose';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { ImageDocument } from '../../models/index.js';
import { allocateContentSlug, isObjectIdString } from '../content/content.utils.js';

export const imageRepository = {
  create(data: Partial<ImageDocument>) {
    return mongoRegistry.models.Image.create(data);
  },

  findByTenant(tenantId: string, lessonId?: string) {
    const query: FilterQuery<ImageDocument> = { tenantId };
    if (lessonId) {
      query.lessonId = lessonId;
    }
    return mongoRegistry.models.Image.find(query)
      .populate('lessonId', 'name slug')
      .sort({ createdAt: 1 });
  },

  async findByRef(ref: string, tenantId: string) {
    if (isObjectIdString(ref)) {
      return mongoRegistry.models.Image.findOne({ _id: ref, tenantId }).populate(
        'lessonId',
        'name slug',
      );
    }
    return mongoRegistry.models.Image.findOne({ slug: ref, tenantId }).populate(
      'lessonId',
      'name slug',
    );
  },

  allocateSlug(tenantId: string, title: string) {
    return allocateContentSlug(mongoRegistry.models.Image, tenantId, title, 'image');
  },

  updateById(id: string, tenantId: string, patch: Partial<ImageDocument>) {
    return mongoRegistry.models.Image.findOneAndUpdate({ _id: id, tenantId }, patch, {
      new: true,
    }).populate('lessonId', 'name slug');
  },

  deleteById(id: string, tenantId: string) {
    return mongoRegistry.models.Image.findOneAndDelete({ _id: id, tenantId });
  },
};
