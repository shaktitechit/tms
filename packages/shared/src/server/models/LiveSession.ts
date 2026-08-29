import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const liveSessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['upcoming', 'live', 'ended'],
      default: 'upcoming',
      index: true,
    },
    scheduledStartTime: {
      type: Date,
      required: true,
    },
    invitedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    recordingStatus: {
      type: String,
      enum: ['none', 'recording', 'processing', 'ready', 'failed'],
      default: 'none',
    },
    recordingVideoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
    },
    endedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

liveSessionSchema.index({ tenantId: 1, status: 1, scheduledStartTime: 1 });

export type LiveSessionDocument = InferSchemaType<typeof liveSessionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const LiveSession: Model<LiveSessionDocument> =
  mongoose.models.LiveSession ??
  mongoose.model<LiveSessionDocument>('LiveSession', liveSessionSchema);
