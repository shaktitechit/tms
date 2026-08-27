import mongoose from 'mongoose';
import { ContentSeenStatus } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';

export const audioSeenRepository = {
  findCompletedByUserAndIds(userId: string, ids: mongoose.Types.ObjectId[]) {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return mongoRegistry.models.AudioSeen.find({
      userId,
      audioId: { $in: ids },
      status: ContentSeenStatus.COMPLETED,
    }).lean();
  },

  upsertCompleted(input: {
    audioId: mongoose.Types.ObjectId;
    userId: string;
    tenantId: string;
  }) {
    return mongoRegistry.models.AudioSeen.findOneAndUpdate(
      { userId: input.userId, audioId: input.audioId },
      {
        $set: {
          status: ContentSeenStatus.COMPLETED,
          tenantId: input.tenantId,
          seenAt: new Date(),
        },
        $setOnInsert: {
          userId: input.userId,
          audioId: input.audioId,
        },
      },
      { upsert: true, new: true },
    );
  },

  deleteByAudioId(id: string) {
    return mongoRegistry.models.AudioSeen.deleteMany({ audioId: id });
  },
};
