import type { TextAreaDocument } from '../../models/index.js';
import { ContentSeenStatus } from '@video/shared';
import type mongoose from 'mongoose';

type PopulatedLesson = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string | null;
};

function lessonFields(doc: TextAreaDocument) {
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

export function serializeTextArea(doc: TextAreaDocument, extra: Record<string, unknown> = {}) {
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    body: doc.body,
    duration: doc.duration ?? null,
    tenantId: String(doc.tenantId),
    createdBy: String(doc.createdBy),
    ...lessonFields(doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    seenStatus: ContentSeenStatus.PENDING,
    ...extra,
  };
}
