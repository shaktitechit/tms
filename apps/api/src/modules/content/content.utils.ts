import mongoose from 'mongoose';
import { slugifySegment } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';

export function isObjectIdString(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === value;
}

/** Resolve an ObjectId string from a raw id or a populated mongoose document. */
export function refId(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'object') {
    if (value instanceof mongoose.Types.ObjectId) {
      return String(value);
    }
    if ('_id' in value && (value as { _id?: unknown })._id != null) {
      return String((value as { _id: unknown })._id);
    }
    if (typeof (value as { toHexString?: () => string }).toHexString === 'function') {
      return (value as { toHexString: () => string }).toHexString();
    }
  }
  return null;
}

export async function allocateContentSlug(
  model: { exists: (query: Record<string, unknown>) => Promise<unknown> },
  tenantId: string,
  title: string,
  fallback: string,
) {
  const base = slugifySegment(title, fallback);
  let slug = base;
  let attempt = 0;
  while (attempt < 12) {
    const existing = await model.exists({ tenantId, slug });
    if (!existing) {
      return slug;
    }
    attempt += 1;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  throw new Error(`Failed to allocate a unique ${fallback} slug`);
}

export function extensionFromFilename(filename: string) {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

export async function resolveLessonObjectId(tenantId: string, lessonRef: string) {
  const ref = lessonRef.trim();
  if (!ref) {
    return null;
  }
  if (isObjectIdString(ref)) {
    return mongoRegistry.models.Lesson.findOne({ _id: ref, tenantId });
  }
  return mongoRegistry.models.Lesson.findOne({ slug: ref, tenantId });
}
