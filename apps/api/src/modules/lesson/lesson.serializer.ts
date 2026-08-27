import type { LessonDocument } from '../../models/index.js';
import type mongoose from 'mongoose';

type PopulatedModule = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string | null;
};

function moduleFields(lesson: LessonDocument) {
  const raw = lesson.moduleId as unknown;
  if (!raw) {
    return { moduleId: null, moduleName: null, moduleSlug: null };
  }
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    const mod = raw as PopulatedModule;
    return {
      moduleId: String(mod._id),
      moduleName: mod.name,
      moduleSlug: mod.slug ?? null,
    };
  }
  return {
    moduleId: String(raw),
    moduleName: null,
    moduleSlug: null,
  };
}

export function serializeLesson(
  lesson: LessonDocument,
  extra: Record<string, unknown> = {},
) {
  return {
    id: String(lesson._id),
    name: lesson.name,
    slug: lesson.slug,
    description: lesson.description,
    authorName: lesson.authorName,
    authorEmail: lesson.authorEmail,
    tenantId: String(lesson.tenantId),
    ...moduleFields(lesson),
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
    serial: typeof lesson.serial === 'number' && lesson.serial > 0 ? lesson.serial : null,
    thumbnailUrl: lesson.thumbnailStorageKey
      ? `/api/lessons/${String(lesson._id)}/thumbnail`
      : null,
    ...extra,
  };
}
