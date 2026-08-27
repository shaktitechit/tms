import mongoose from 'mongoose';
import { ContentSeenStatus } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';

export const textAreaSeenRepository = {
  findCompletedByUserAndIds(userId: string, ids: mongoose.Types.ObjectId[]) {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return mongoRegistry.models.TextAreaSeen.find({
      userId,
      textAreaId: { $in: ids },
      status: ContentSeenStatus.COMPLETED,
    }).lean();
  },

  upsertCompleted(input: {
    textAreaId: mongoose.Types.ObjectId;
    userId: string;
    tenantId: string;
  }) {
    return mongoRegistry.models.TextAreaSeen.findOneAndUpdate(
      { userId: input.userId, textAreaId: input.textAreaId },
      {
        $set: {
          status: ContentSeenStatus.COMPLETED,
          tenantId: input.tenantId,
          seenAt: new Date(),
        },
        $setOnInsert: {
          userId: input.userId,
          textAreaId: input.textAreaId,
        },
      },
      { upsert: true, new: true },
    );
  },

  deleteByTextAreaId(textAreaId: string) {
    return mongoRegistry.models.TextAreaSeen.deleteMany({ textAreaId });
  },
};
