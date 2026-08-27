import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const textAreaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
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
    body: {
      type: String,
      required: true,
      default: '',
      maxlength: 100_000,
    },
    duration: {
      type: Number,
      min: 0,
      default: null,
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
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

textAreaSchema.index(
  { tenantId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' } } },
);
textAreaSchema.index({ tenantId: 1, lessonId: 1, createdAt: -1 });

export type TextAreaDocument = InferSchemaType<typeof textAreaSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const TextArea: Model<TextAreaDocument> =
  mongoose.models.TextArea ?? mongoose.model<TextAreaDocument>('TextArea', textAreaSchema);
