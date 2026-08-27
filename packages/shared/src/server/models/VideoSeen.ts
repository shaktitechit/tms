import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { ContentSeenStatus } from '../../types.js';

const videoSeenSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ContentSeenStatus),
      default: ContentSeenStatus.PENDING,
      index: true,
    },
    seenAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

videoSeenSchema.index({ userId: 1, videoId: 1 }, { unique: true });
videoSeenSchema.index({ tenantId: 1, userId: 1, status: 1 });

export type VideoSeenDocument = InferSchemaType<typeof videoSeenSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const VideoSeen: Model<VideoSeenDocument> =
  mongoose.models.VideoSeen ?? mongoose.model<VideoSeenDocument>('VideoSeen', videoSeenSchema);
