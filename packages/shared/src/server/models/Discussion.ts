import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const discussionSchema = new mongoose.Schema(
  {
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      index: true,
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discussion',
      index: true,
    },
  },
  { timestamps: true },
);

discussionSchema.index({ tenantId: 1, videoId: 1, createdAt: -1 });
discussionSchema.index({ tenantId: 1, lessonId: 1, createdAt: -1 });
discussionSchema.index({ parentId: 1, createdAt: 1 });
discussionSchema.index({ createdBy: 1, createdAt: -1 });

export type DiscussionDocument = InferSchemaType<typeof discussionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Discussion: Model<DiscussionDocument> =
  mongoose.models.Discussion ?? mongoose.model<DiscussionDocument>('Discussion', discussionSchema);
