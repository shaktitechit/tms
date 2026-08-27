import type { AudioDocument } from '../../models/index.js';
import { AudioStatus, ContentSeenStatus } from '@video/shared';
import type mongoose from 'mongoose';

type PopulatedLesson = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string | null;
};

function lessonFields(doc: AudioDocument) {
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

export function serializeAudio(doc: AudioDocument, extra: Record<string, unknown> = {}) {
  const id = String(doc._id);
  const status = (doc.status as AudioStatus | undefined) ?? AudioStatus.READY;
  const ready = status === AudioStatus.READY && Boolean(doc.hlsMasterPlaylistKey);

  return {
    id,
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    duration: doc.duration ?? null,
    status,
    processingProgress: doc.processingProgress ?? 0,
    availableQualities: doc.availableQualities ?? [],
    errorMessage: doc.errorMessage ?? null,
    tenantId: String(doc.tenantId),
    createdBy: String(doc.createdBy),
    ...lessonFields(doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    fileUrl: `/api/audios/${id}/file`,
    streamUrl: `/api/audios/${id}/stream`,
    playbackUrl: ready ? `/api/audios/${id}/hls/master.m3u8` : null,
    seenStatus: ContentSeenStatus.PENDING,
    ...extra,
  };
}

export function serializeAudioStatus(doc: AudioDocument) {
  return {
    id: String(doc._id),
    slug: doc.slug,
    status: doc.status ?? AudioStatus.UPLOADING,
    progress: doc.processingProgress ?? 0,
    errorMessage: doc.errorMessage ?? null,
  };
}
