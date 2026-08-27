import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { ContentSeenStatus } from '../../types.js';

const pdfSeenSchema = new mongoose.Schema(
  {
    pdfId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pdf',
      required: true,
      index: true,
    },
    userId: {
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
    status: {
      type: String,
      enum: Object.values(ContentSeenStatus),
      default: ContentSeenStatus.PENDING,
      index: true,
    },
    seenAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

pdfSeenSchema.index({ userId: 1, pdfId: 1 }, { unique: true });
pdfSeenSchema.index({ tenantId: 1, userId: 1, status: 1 });

export type PdfSeenDocument = InferSchemaType<typeof pdfSeenSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const PdfSeen: Model<PdfSeenDocument> =
  mongoose.models.PdfSeen ?? mongoose.model<PdfSeenDocument>('PdfSeen', pdfSeenSchema);
