import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { VideoQuality, VideoSourceType, VideoStatus, VideoVisibility } from '../../types.js';

const videoSchema = new mongoose.Schema(
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
    sourceType: {
      type: String,
      enum: Object.values(VideoSourceType),
      default: VideoSourceType.FILE,
    },
    youtubeVideoId: {
      type: String,
      trim: true,
      maxlength: 11,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    originalStorageKey: {
      type: String,
      required: true,
    },
    thumbnailStorageKey: {
      type: String,
    },
    hlsMasterPlaylistKey: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(VideoStatus),
      default: VideoStatus.UPLOADING,
      index: true,
    },
    processingProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    duration: {
      type: Number,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    availableQualities: {
      type: [
        {
          type: String,
          enum: Object.values(VideoQuality),
        },
      ],
      default: [],
    },
    visibility: {
      type: String,
      enum: Object.values(VideoVisibility),
      default: VideoVisibility.PUBLIC,
      index: true,
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
      index: true,
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      index: true,
    },
    errorMessage: {
      type: String,
    },
  },
  { timestamps: true },
);

videoSchema.index(
  { tenantId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' } } },
);
videoSchema.index({ tenantId: 1, createdAt: -1 });
videoSchema.index({ createdBy: 1, createdAt: -1 });
videoSchema.index({ status: 1, createdAt: -1 });
videoSchema.index({ visibility: 1, status: 1, createdAt: -1 });
videoSchema.index({ tenantId: 1, moduleId: 1, createdAt: -1 });
videoSchema.index({ tenantId: 1, lessonId: 1, createdAt: -1 });
videoSchema.index({ createdAt: -1 });
videoSchema.index({ slug: 1 });

export type VideoDocument = InferSchemaType<typeof videoSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Video: Model<VideoDocument> =
  mongoose.models.Video ?? mongoose.model<VideoDocument>('Video', videoSchema);
