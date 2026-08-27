import mongoose from 'mongoose';
import { VideoSeenStatus } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';

export const videoSeenRepository = {
  findCompletedByUserAndVideoIds(userId: string, videoIds: mongoose.Types.ObjectId[]) {
    if (videoIds.length === 0) {
      return Promise.resolve([]);
    }
    return mongoRegistry.models.VideoSeen.find({
      userId,
      videoId: { $in: videoIds },
      status: VideoSeenStatus.COMPLETED,
    }).lean();
  },

  upsertCompleted(input: {
    videoId: mongoose.Types.ObjectId;
    userId: string;
    tenantId: string;
  }) {
    return mongoRegistry.models.VideoSeen.findOneAndUpdate(
      { userId: input.userId, videoId: input.videoId },
      {
        $set: {
          status: VideoSeenStatus.COMPLETED,
          tenantId: input.tenantId,
          seenAt: new Date(),
        },
        $setOnInsert: {
          userId: input.userId,
          videoId: input.videoId,
        },
      },
      { upsert: true, new: true },
    );
  },

  deleteByVideoId(videoId: string) {
    return mongoRegistry.models.VideoSeen.deleteMany({ videoId });
  },
};
