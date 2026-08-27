import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { AudioQuality, AudioStatus } from '../../types.js';

const audioSchema = new mongoose.Schema(
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
      maxlength: 5000,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    hlsMasterPlaylistKey: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(AudioStatus),
      default: AudioStatus.UPLOADING,
      index: true,
    },
    processingProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number,
    },
    availableQualities: {
      type: [
        {
          type: String,
          enum: Object.values(AudioQuality),
        },
      ],
      default: [],
    },
    errorMessage: {
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
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      index: true,
    },
  },
  { timestamps: true },
);

audioSchema.index(
  { tenantId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' } } },
);
audioSchema.index({ tenantId: 1, lessonId: 1, createdAt: -1 });
audioSchema.index({ status: 1, createdAt: -1 });

export type AudioDocument = InferSchemaType<typeof audioSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Audio: Model<AudioDocument> =
  mongoose.models.Audio ?? mongoose.model<AudioDocument>('Audio', audioSchema);
