import type { FilterQuery } from 'mongoose';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { PdfDocument } from '../../models/index.js';
import { allocateContentSlug, isObjectIdString } from '../content/content.utils.js';

export const pdfRepository = {
  create(data: Partial<PdfDocument>) {
    return mongoRegistry.models.Pdf.create(data);
  },

  findByTenant(tenantId: string, lessonId?: string) {
    const query: FilterQuery<PdfDocument> = { tenantId };
    if (lessonId) {
      query.lessonId = lessonId;
    }
    return mongoRegistry.models.Pdf.find(query)
      .populate('lessonId', 'name slug')
      .sort({ createdAt: 1 });
  },

  async findByRef(ref: string, tenantId: string) {
    if (isObjectIdString(ref)) {
      return mongoRegistry.models.Pdf.findOne({ _id: ref, tenantId }).populate(
        'lessonId',
        'name slug',
      );
    }
    return mongoRegistry.models.Pdf.findOne({ slug: ref, tenantId }).populate(
      'lessonId',
      'name slug',
    );
  },

  allocateSlug(tenantId: string, title: string) {
    return allocateContentSlug(mongoRegistry.models.Pdf, tenantId, title, 'pdf');
  },

  updateById(id: string, tenantId: string, patch: Partial<PdfDocument>) {
    return mongoRegistry.models.Pdf.findOneAndUpdate({ _id: id, tenantId }, patch, {
      new: true,
    }).populate('lessonId', 'name slug');
  },

  deleteById(id: string, tenantId: string) {
    return mongoRegistry.models.Pdf.findOneAndDelete({ _id: id, tenantId });
  },
};
