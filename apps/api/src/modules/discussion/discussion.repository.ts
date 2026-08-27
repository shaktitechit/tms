import mongoose, { type FilterQuery } from 'mongoose';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { DiscussionDocument } from '../../models/index.js';

const AUTHOR_FIELDS = 'name username';

function isObjectIdString(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === value;
}

export const discussionRepository = {
  isObjectIdString,

  create(data: Partial<DiscussionDocument> & { _id?: DiscussionDocument['_id'] }) {
    return mongoRegistry.models.Discussion.create(data);
  },

  find(query: FilterQuery<DiscussionDocument>) {
    return mongoRegistry.models.Discussion.find(query)
      .populate('createdBy', AUTHOR_FIELDS)
      .sort({ createdAt: 1 });
  },

  findById(id: string) {
    return mongoRegistry.models.Discussion.findById(id).populate('createdBy', AUTHOR_FIELDS);
  },

  findOne(query: FilterQuery<DiscussionDocument>) {
    return mongoRegistry.models.Discussion.findOne(query).populate('createdBy', AUTHOR_FIELDS);
  },

  updateById(id: string, tenantId: string, patch: Partial<DiscussionDocument>) {
    return mongoRegistry.models.Discussion.findOneAndUpdate({ _id: id, tenantId }, patch, {
      new: true,
    }).populate('createdBy', AUTHOR_FIELDS);
  },

  deleteById(id: string, tenantId: string) {
    return mongoRegistry.models.Discussion.findOneAndDelete({ _id: id, tenantId });
  },

  deleteThread(id: string, tenantId: string) {
    return mongoRegistry.models.Discussion.deleteMany({
      tenantId,
      $or: [{ _id: id }, { parentId: id }],
    });
  },

  deleteByVideoId(videoId: string) {
    return mongoRegistry.models.Discussion.deleteMany({ videoId });
  },

  deleteByLessonId(lessonId: string) {
    return mongoRegistry.models.Discussion.deleteMany({ lessonId });
  },
};
