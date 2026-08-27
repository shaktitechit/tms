import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    logoStorageKey: {
      type: String,
    },
  },
  { timestamps: true },
);

export type TenantDocument = InferSchemaType<typeof tenantSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Tenant: Model<TenantDocument> =
  mongoose.models.Tenant ?? mongoose.model<TenantDocument>('Tenant', tenantSchema);
