import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { MemberAccess, UserRole } from '../../types.js';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 48,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    access: {
      type: String,
      enum: Object.values(MemberAccess),
      default: MemberAccess.LEARNER,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    departmentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
  },
  { timestamps: true },
);

userSchema.index({ tenantId: 1, email: 1 });
userSchema.index({ tenantId: 1, username: 1 }, { unique: true });
userSchema.index({ tenantId: 1, departmentIds: 1 });

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const User: Model<UserDocument> =
  mongoose.models.User ?? mongoose.model<UserDocument>('User', userSchema);
