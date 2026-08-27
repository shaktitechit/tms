import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { ContentSeenStatus } from '../../types.js';

const audioSeenSchema = new mongoose.Schema(
  {
    audioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Audio',
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

audioSeenSchema.index({ userId: 1, audioId: 1 }, { unique: true });
audioSeenSchema.index({ tenantId: 1, userId: 1, status: 1 });

export type AudioSeenDocument = InferSchemaType<typeof audioSeenSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const AudioSeen: Model<AudioSeenDocument> =
  mongoose.models.AudioSeen ?? mongoose.model<AudioSeenDocument>('AudioSeen', audioSeenSchema);
