import type { FilterQuery } from 'mongoose';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { TextAreaDocument } from '../../models/index.js';
import { allocateContentSlug, isObjectIdString } from '../content/content.utils.js';

export const textAreaRepository = {
  create(data: Partial<TextAreaDocument>) {
    return mongoRegistry.models.TextArea.create(data);
  },

  findByTenant(tenantId: string, lessonId?: string) {
    const query: FilterQuery<TextAreaDocument> = { tenantId };
    if (lessonId) {
      query.lessonId = lessonId;
    }
    return mongoRegistry.models.TextArea.find(query)
      .populate('lessonId', 'name slug')
      .sort({ createdAt: 1 });
  },

  findById(id: string) {
    return mongoRegistry.models.TextArea.findById(id).populate('lessonId', 'name slug');
  },

  async findByRef(ref: string, tenantId: string) {
    if (isObjectIdString(ref)) {
      return mongoRegistry.models.TextArea.findOne({ _id: ref, tenantId }).populate(
        'lessonId',
        'name slug',
      );
    }
    return mongoRegistry.models.TextArea.findOne({ slug: ref, tenantId }).populate(
      'lessonId',
      'name slug',
    );
  },

  allocateSlug(tenantId: string, title: string) {
    return allocateContentSlug(mongoRegistry.models.TextArea, tenantId, title, 'text-area');
  },

  updateById(id: string, tenantId: string, patch: Partial<TextAreaDocument>) {
    return mongoRegistry.models.TextArea.findOneAndUpdate({ _id: id, tenantId }, patch, {
      new: true,
    }).populate('lessonId', 'name slug');
  },

  deleteById(id: string, tenantId: string) {
    return mongoRegistry.models.TextArea.findOneAndDelete({ _id: id, tenantId });
  },
};
