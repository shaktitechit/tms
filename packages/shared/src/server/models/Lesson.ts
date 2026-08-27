import mongoose, { type InferSchemaType, type Model } from 'mongoose';

export const LESSON_CONTENT_KINDS = [
  'text',
  'video',
  'audio',
  'image',
  'quiz',
  'pdf',
] as const;

export type LessonContentKind = (typeof LESSON_CONTENT_KINDS)[number];

const contentOrderEntrySchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: LESSON_CONTENT_KINDS,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: false },
);

const lessonSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      trim: true,
      maxlength: 80,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
    },
    thumbnailStorageKey: {
      type: String,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    authorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    createdBy: {
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
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      index: true,
    },
    serial: {
      type: Number,
      min: 1,
    },
    contentOrder: {
      type: [contentOrderEntrySchema],
      default: [],
    },
  },
  { timestamps: true },
);

lessonSchema.index(
  { tenantId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' } } },
);
lessonSchema.index({ tenantId: 1, createdAt: -1 });
lessonSchema.index({ tenantId: 1, moduleId: 1, createdAt: -1 });
lessonSchema.index({ tenantId: 1, moduleId: 1, serial: 1 });

export type LessonDocument = InferSchemaType<typeof lessonSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Lesson: Model<LessonDocument> =
  mongoose.models.Lesson ?? mongoose.model<LessonDocument>('Lesson', lessonSchema);
