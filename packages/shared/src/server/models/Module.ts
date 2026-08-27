import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const moduleSchema = new mongoose.Schema(
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
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
  },
  { timestamps: true },
);

moduleSchema.index(
  { tenantId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' } } },
);
moduleSchema.index({ tenantId: 1, createdAt: -1 });
moduleSchema.index({ tenantId: 1, departmentId: 1, createdAt: -1 });

export type ModuleDocument = InferSchemaType<typeof moduleSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Module: Model<ModuleDocument> =
  mongoose.models.Module ?? mongoose.model<ModuleDocument>('Module', moduleSchema);
