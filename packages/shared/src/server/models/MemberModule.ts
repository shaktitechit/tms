import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const memberModuleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
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

memberModuleSchema.index({ tenantId: 1, userId: 1, moduleId: 1 }, { unique: true });
memberModuleSchema.index({ tenantId: 1, userId: 1 });
memberModuleSchema.index({ tenantId: 1, moduleId: 1 });

export type MemberModuleDocument = InferSchemaType<typeof memberModuleSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const MemberModule: Model<MemberModuleDocument> =
  mongoose.models.MemberModule ??
  mongoose.model<MemberModuleDocument>('MemberModule', memberModuleSchema);
