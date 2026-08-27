import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const pdfSchema = new mongoose.Schema(
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
    mimeType: {
      type: String,
      required: true,
      default: 'application/pdf',
    },
    fileSize: {
      type: Number,
      required: true,
    },
    pageCount: {
      type: Number,
    },
    duration: {
      type: Number,
      min: 0,
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

pdfSchema.index(
  { tenantId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' } } },
);
pdfSchema.index({ tenantId: 1, lessonId: 1, createdAt: -1 });

export type PdfDocument = InferSchemaType<typeof pdfSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Pdf: Model<PdfDocument> =
  mongoose.models.Pdf ?? mongoose.model<PdfDocument>('Pdf', pdfSchema);
