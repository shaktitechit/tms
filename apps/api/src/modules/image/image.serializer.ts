import type { ImageDocument } from '../../models/index.js';
import { ContentSeenStatus } from '@video/shared';
import type mongoose from 'mongoose';

type PopulatedLesson = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string | null;
};

function lessonFields(doc: ImageDocument) {
  const raw = doc.lessonId as unknown;
  if (!raw) {
    return { lessonId: null, lessonName: null, lessonSlug: null };
  }
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    const lesson = raw as PopulatedLesson;
    return {
      lessonId: String(lesson._id),
      lessonName: lesson.name,
      lessonSlug: lesson.slug ?? null,
    };
  }
  return {
    lessonId: String(raw),
    lessonName: null,
    lessonSlug: null,
  };
}

export function serializeImage(doc: ImageDocument, extra: Record<string, unknown> = {}) {
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    width: doc.width ?? null,
    height: doc.height ?? null,
    duration: doc.duration ?? null,
    tenantId: String(doc.tenantId),
    createdBy: String(doc.createdBy),
    ...lessonFields(doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    fileUrl: `/api/images/${String(doc._id)}/file`,
    seenStatus: ContentSeenStatus.PENDING,
    ...extra,
  };
}
