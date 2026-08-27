import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const departmentSchema = new mongoose.Schema(
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
  },
  { timestamps: true },
);

departmentSchema.index(
  { tenantId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' } } },
);
departmentSchema.index({ tenantId: 1, createdAt: -1 });

export type DepartmentDocument = InferSchemaType<typeof departmentSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Department: Model<DepartmentDocument> =
  mongoose.models.Department ??
  mongoose.model<DepartmentDocument>('Department', departmentSchema);
