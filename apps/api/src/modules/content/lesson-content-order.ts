import mongoose from 'mongoose';
import { ERROR_CODES } from '@video/shared';
import { badRequest, notFound } from '../../http/errors.js';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import { refId } from './content.utils.js';

export const LESSON_CONTENT_KINDS = [
  'text',
  'video',
  'audio',
  'image',
  'quiz',
  'pdf',
] as const;

export type LessonContentKind = (typeof LESSON_CONTENT_KINDS)[number];

export type LessonContentOrderItem = {
  kind: LessonContentKind;
  id: string;
};

type StoredOrderEntry = {
  kind: LessonContentKind;
  contentId: mongoose.Types.ObjectId | string;
};

type PresentContent = {
  kind: LessonContentKind;
  id: string;
  createdAt: Date;
};

function isContentKind(value: string): value is LessonContentKind {
  return (LESSON_CONTENT_KINDS as readonly string[]).includes(value);
}

export function serializeContentOrder(
  entries: StoredOrderEntry[] | undefined | null,
): LessonContentOrderItem[] {
  if (!entries?.length) {
    return [];
  }
  return entries
    .filter((entry) => isContentKind(String(entry.kind)))
    .map((entry) => ({
      kind: entry.kind as LessonContentKind,
      id: String(entry.contentId),
    }));
}

/** Merge stored order with live content; append any missing items by createdAt. */
export function reconcileContentOrder(
  stored: StoredOrderEntry[] | undefined | null,
  present: PresentContent[],
): LessonContentOrderItem[] {
  const presentMap = new Map(present.map((item) => [`${item.kind}:${item.id}`, item]));
  const ordered: LessonContentOrderItem[] = [];
  const seen = new Set<string>();

  for (const entry of stored ?? []) {
    const kind = String(entry.kind);
    if (!isContentKind(kind)) {
      continue;
    }
    const key = `${kind}:${String(entry.contentId)}`;
    if (!presentMap.has(key) || seen.has(key)) {
      continue;
    }
    ordered.push({ kind, id: String(entry.contentId) });
    seen.add(key);
  }

  const missing = present
    .filter((item) => !seen.has(`${item.kind}:${item.id}`))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const item of missing) {
    ordered.push({ kind: item.kind, id: item.id });
  }

  return ordered;
}

export function contentOrderChanged(
  previous: LessonContentOrderItem[],
  next: LessonContentOrderItem[],
) {
  if (previous.length !== next.length) {
    return true;
  }
  return previous.some((item, index) => item.kind !== next[index]?.kind || item.id !== next[index]?.id);
}

export async function appendLessonContentOrder(
  lessonId: string | mongoose.Types.ObjectId,
  kind: LessonContentKind,
  contentId: string | mongoose.Types.ObjectId,
) {
  await mongoRegistry.models.Lesson.updateOne(
    { _id: lessonId },
    {
      $push: {
        contentOrder: {
          kind,
          contentId: new mongoose.Types.ObjectId(String(contentId)),
        },
      },
    },
  );
}

export async function removeLessonContentOrder(
  lessonId: string | mongoose.Types.ObjectId | null | undefined | unknown,
  contentId: string | mongoose.Types.ObjectId,
) {
  const lessonRef = refId(lessonId);
  if (!lessonRef) {
    return;
  }
  await mongoRegistry.models.Lesson.updateOne(
    { _id: lessonRef },
    { $pull: { contentOrder: { contentId: new mongoose.Types.ObjectId(String(contentId)) } } },
  );
}

export async function moveLessonContentOrder(
  fromLessonId: string | mongoose.Types.ObjectId | null | undefined | unknown,
  toLessonId: string | mongoose.Types.ObjectId | null | undefined | unknown,
  kind: LessonContentKind,
  contentId: string | mongoose.Types.ObjectId,
) {
  const from = refId(fromLessonId);
  const to = refId(toLessonId);
  if (from === to) {
    return;
  }
  if (from) {
    await removeLessonContentOrder(from, contentId);
  }
  if (to) {
    await appendLessonContentOrder(to, kind, contentId);
  }
}

async function assertContentBelongsToLesson(
  tenantId: string,
  lessonId: string,
  item: LessonContentOrderItem,
) {
  const filter = {
    _id: item.id,
    tenantId,
    lessonId,
  };

  let exists = false;
  switch (item.kind) {
    case 'text':
      exists = Boolean(await mongoRegistry.models.TextArea.exists(filter));
      break;
    case 'video':
      exists = Boolean(await mongoRegistry.models.Video.exists(filter));
      break;
    case 'audio':
      exists = Boolean(await mongoRegistry.models.Audio.exists(filter));
      break;
    case 'image':
      exists = Boolean(await mongoRegistry.models.Image.exists(filter));
      break;
    case 'quiz':
      exists = Boolean(await mongoRegistry.models.Quiz.exists(filter));
      break;
    case 'pdf':
      exists = Boolean(await mongoRegistry.models.Pdf.exists(filter));
      break;
    default:
      throw badRequest(`Unknown content kind: ${(item as LessonContentOrderItem).kind}`);
  }

  if (!exists) {
    throw notFound(`Content not found for lesson: ${item.kind}/${item.id}`, ERROR_CODES.NOT_FOUND);
  }
}

export async function setLessonContentOrder(
  lessonId: string,
  tenantId: string,
  items: LessonContentOrderItem[],
) {
  const seen = new Set<string>();
  for (const item of items) {
    if (!isContentKind(item.kind)) {
      throw badRequest(`Invalid content kind: ${item.kind}`);
    }
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) {
      throw badRequest('Duplicate content entries in order');
    }
    seen.add(key);
    await assertContentBelongsToLesson(tenantId, lessonId, item);
  }

  const contentOrder = items.map((item) => ({
    kind: item.kind,
    contentId: new mongoose.Types.ObjectId(item.id),
  }));

  const updated = await mongoRegistry.models.Lesson.findOneAndUpdate(
    { _id: lessonId, tenantId },
    { $set: { contentOrder } },
    { new: true },
  );

  if (!updated) {
    throw notFound('Lesson not found', ERROR_CODES.NOT_FOUND);
  }

  return serializeContentOrder(updated.contentOrder as StoredOrderEntry[]);
}
