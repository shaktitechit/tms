import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { ContentSeenStatus } from '../../types.js';

const imageSeenSchema = new mongoose.Schema(
  {
    imageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Image',
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

imageSeenSchema.index({ userId: 1, imageId: 1 }, { unique: true });
imageSeenSchema.index({ tenantId: 1, userId: 1, status: 1 });

export type ImageSeenDocument = InferSchemaType<typeof imageSeenSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ImageSeen: Model<ImageSeenDocument> =
  mongoose.models.ImageSeen ?? mongoose.model<ImageSeenDocument>('ImageSeen', imageSeenSchema);
