import mongoose from 'mongoose';
import { ContentSeenStatus } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';

export const imageSeenRepository = {
  findCompletedByUserAndIds(userId: string, ids: mongoose.Types.ObjectId[]) {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return mongoRegistry.models.ImageSeen.find({
      userId,
      imageId: { $in: ids },
      status: ContentSeenStatus.COMPLETED,
    }).lean();
  },

  upsertCompleted(input: {
    imageId: mongoose.Types.ObjectId;
    userId: string;
    tenantId: string;
  }) {
    return mongoRegistry.models.ImageSeen.findOneAndUpdate(
      { userId: input.userId, imageId: input.imageId },
      {
        $set: {
          status: ContentSeenStatus.COMPLETED,
          tenantId: input.tenantId,
          seenAt: new Date(),
        },
        $setOnInsert: {
          userId: input.userId,
          imageId: input.imageId,
        },
      },
      { upsert: true, new: true },
    );
  },

  deleteByImageId(id: string) {
    return mongoRegistry.models.ImageSeen.deleteMany({ imageId: id });
  },
};
