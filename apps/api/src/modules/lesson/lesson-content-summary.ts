import mongoose from 'mongoose';
import { ContentSeenStatus } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import { audioSeenRepository } from '../audio/audio-seen.repository.js';
import { imageSeenRepository } from '../image/image-seen.repository.js';
import { pdfSeenRepository } from '../pdf/pdf-seen.repository.js';
import { quizSeenRepository } from '../quiz/quiz-seen.repository.js';
import { textAreaSeenRepository } from '../text-area/text-area-seen.repository.js';
import { videoSeenRepository } from '../video/video-seen.repository.js';

export type LessonContentSummary = {
  duration: number;
  contentCount: number;
  completedPercent: number;
  seenStatus: ContentSeenStatus;
};

export function numericDuration(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Quiz length is the sum of per-question timers (default 30s, matching quiz serializer). */
export function quizDurationSeconds(
  questions?: Array<{ duration?: number | null }> | null,
): number {
  return (questions ?? []).reduce((sum, question) => {
    return sum + (typeof question.duration === 'number' && question.duration > 0 ? question.duration : 30);
  }, 0);
}

export function contentSummaryFromItems(
  items: Array<{ duration: number; completed: boolean }>,
): LessonContentSummary {
  const duration = items.reduce((sum, item) => sum + item.duration, 0);
  const completedDuration = items.reduce(
    (sum, item) => sum + (item.completed ? item.duration : 0),
    0,
  );
  const contentCount = items.length;
  const completedCount = items.filter((item) => item.completed).length;
  const seenStatus =
    contentCount > 0 && completedCount === contentCount
      ? ContentSeenStatus.COMPLETED
      : ContentSeenStatus.PENDING;
  const completedPercent =
    contentCount === 0
      ? 0
      : seenStatus === ContentSeenStatus.COMPLETED
        ? 100
        : duration > 0
          ? Math.min(100, Math.round((completedDuration / duration) * 100))
          : Math.round((completedCount / contentCount) * 100);
  return {
    duration,
    contentCount,
    completedPercent,
    seenStatus,
  };
}

export async function summarizeLessonsForActor(
  actor: { id: string; tenantId: string },
  lessonIds: mongoose.Types.ObjectId[],
): Promise<Map<string, LessonContentSummary>> {
  const summaries = new Map<string, LessonContentSummary>();
  for (const lessonId of lessonIds) {
    summaries.set(String(lessonId), contentSummaryFromItems([]));
  }
  if (lessonIds.length === 0) {
    return summaries;
  }

  const filter = { tenantId: actor.tenantId, lessonId: { $in: lessonIds } };
  const [textAreas, videos, audios, images, quizzes, pdfs] = await Promise.all([
    mongoRegistry.models.TextArea.find(filter).select('_id lessonId duration').lean(),
    mongoRegistry.models.Video.find(filter).select('_id lessonId duration').lean(),
    mongoRegistry.models.Audio.find(filter).select('_id lessonId duration').lean(),
    mongoRegistry.models.Image.find(filter).select('_id lessonId duration').lean(),
    mongoRegistry.models.Quiz.find(filter).select('_id lessonId questions.duration').lean(),
    mongoRegistry.models.Pdf.find(filter).select('_id lessonId duration').lean(),
  ]);

  const [
    completedText,
    completedVideos,
    completedAudios,
    completedImages,
    completedPdfs,
    completedQuizzes,
  ] = await Promise.all([
    textAreaSeenRepository.findCompletedByUserAndIds(
      actor.id,
      textAreas.map((item) => item._id),
    ),
    videoSeenRepository.findCompletedByUserAndVideoIds(
      actor.id,
      videos.map((item) => item._id),
    ),
    audioSeenRepository.findCompletedByUserAndIds(
      actor.id,
      audios.map((item) => item._id),
    ),
    imageSeenRepository.findCompletedByUserAndIds(
      actor.id,
      images.map((item) => item._id),
    ),
    pdfSeenRepository.findCompletedByUserAndIds(
      actor.id,
      pdfs.map((item) => item._id),
    ),
    quizSeenRepository.findCompletedByUserAndIds(
      actor.id,
      quizzes.map((item) => item._id),
    ),
  ]);

  const completedIds = new Set([
    ...completedText.map((row) => String(row.textAreaId)),
    ...completedVideos.map((row) => String(row.videoId)),
    ...completedAudios.map((row) => String(row.audioId)),
    ...completedImages.map((row) => String(row.imageId)),
    ...completedPdfs.map((row) => String(row.pdfId)),
    ...completedQuizzes.map((row) => String(row.quizId)),
  ]);

  const itemsByLesson = new Map<string, Array<{ duration: number; completed: boolean }>>();

  function add(lessonId: unknown, duration: number, itemId: unknown) {
    const key = String(lessonId);
    const list = itemsByLesson.get(key) ?? [];
    list.push({ duration, completed: completedIds.has(String(itemId)) });
    itemsByLesson.set(key, list);
  }

  for (const item of textAreas) {
    add(item.lessonId, numericDuration(item.duration), item._id);
  }
  for (const item of videos) {
    add(item.lessonId, numericDuration(item.duration), item._id);
  }
  for (const item of audios) {
    add(item.lessonId, numericDuration(item.duration), item._id);
  }
  for (const item of images) {
    add(item.lessonId, numericDuration(item.duration), item._id);
  }
  for (const item of quizzes) {
    add(item.lessonId, quizDurationSeconds(item.questions), item._id);
  }
  for (const item of pdfs) {
    add(item.lessonId, numericDuration(item.duration), item._id);
  }

  for (const lessonId of lessonIds) {
    const key = String(lessonId);
    summaries.set(key, contentSummaryFromItems(itemsByLesson.get(key) ?? []));
  }

  return summaries;
}
