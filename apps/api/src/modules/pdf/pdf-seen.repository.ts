import mongoose from 'mongoose';
import { ContentSeenStatus } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';

export const pdfSeenRepository = {
  findCompletedByUserAndIds(userId: string, ids: mongoose.Types.ObjectId[]) {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return mongoRegistry.models.PdfSeen.find({
      userId,
      pdfId: { $in: ids },
      status: ContentSeenStatus.COMPLETED,
    }).lean();
  },

  upsertCompleted(input: {
    pdfId: mongoose.Types.ObjectId;
    userId: string;
    tenantId: string;
  }) {
    return mongoRegistry.models.PdfSeen.findOneAndUpdate(
      { userId: input.userId, pdfId: input.pdfId },
      {
        $set: {
          status: ContentSeenStatus.COMPLETED,
          tenantId: input.tenantId,
          seenAt: new Date(),
        },
        $setOnInsert: {
          userId: input.userId,
          pdfId: input.pdfId,
        },
      },
      { upsert: true, new: true },
    );
  },

  deleteByPdfId(id: string) {
    return mongoRegistry.models.PdfSeen.deleteMany({ pdfId: id });
  },
};
