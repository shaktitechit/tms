import type { FilterQuery } from 'mongoose';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { AudioDocument } from '../../models/index.js';
import { allocateContentSlug, isObjectIdString } from '../content/content.utils.js';

export const audioRepository = {
  create(data: Partial<AudioDocument>) {
    return mongoRegistry.models.Audio.create(data);
  },

  findByTenant(tenantId: string, lessonId?: string) {
    const query: FilterQuery<AudioDocument> = { tenantId };
    if (lessonId) {
      query.lessonId = lessonId;
    }
    return mongoRegistry.models.Audio.find(query)
      .populate('lessonId', 'name slug')
      .sort({ createdAt: 1 });
  },

  async findByRef(ref: string, tenantId: string) {
    if (isObjectIdString(ref)) {
      return mongoRegistry.models.Audio.findOne({ _id: ref, tenantId }).populate(
        'lessonId',
        'name slug',
      );
    }
    return mongoRegistry.models.Audio.findOne({ slug: ref, tenantId }).populate(
      'lessonId',
      'name slug',
    );
  },

  allocateSlug(tenantId: string, title: string) {
    return allocateContentSlug(mongoRegistry.models.Audio, tenantId, title, 'audio');
  },

  updateById(id: string, tenantId: string, patch: Partial<AudioDocument>) {
    return mongoRegistry.models.Audio.findOneAndUpdate({ _id: id, tenantId }, patch, {
      new: true,
    }).populate('lessonId', 'name slug');
  },

  deleteById(id: string, tenantId: string) {
    return mongoRegistry.models.Audio.findOneAndDelete({ _id: id, tenantId });
  },
};
