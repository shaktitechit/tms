import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const liveChatMessageSchema = new mongoose.Schema(
  {
    liveSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LiveSession',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

liveChatMessageSchema.index({ liveSessionId: 1, createdAt: 1 });

export type LiveChatMessageDocument = InferSchemaType<typeof liveChatMessageSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const LiveChatMessage: Model<LiveChatMessageDocument> =
  mongoose.models.LiveChatMessage ??
  mongoose.model<LiveChatMessageDocument>('LiveChatMessage', liveChatMessageSchema);
