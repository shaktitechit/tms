import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { ContentSeenStatus } from '../../types.js';

const textAreaSeenSchema = new mongoose.Schema(
  {
    textAreaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TextArea',
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

textAreaSeenSchema.index({ userId: 1, textAreaId: 1 }, { unique: true });
textAreaSeenSchema.index({ tenantId: 1, userId: 1, status: 1 });

export type TextAreaSeenDocument = InferSchemaType<typeof textAreaSeenSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const TextAreaSeen: Model<TextAreaSeenDocument> =
  mongoose.models.TextAreaSeen ??
  mongoose.model<TextAreaSeenDocument>('TextAreaSeen', textAreaSeenSchema);
