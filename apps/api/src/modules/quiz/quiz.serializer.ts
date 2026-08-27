import type { QuizDocument } from '../../models/index.js';
import { ContentSeenStatus } from '@video/shared';
import type mongoose from 'mongoose';

type PopulatedLesson = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string | null;
};

function lessonFields(doc: QuizDocument) {
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

export function serializeQuiz(doc: QuizDocument, extra: Record<string, unknown> = {}) {
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    questions: (doc.questions ?? []).map((q) => ({
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      duration: typeof q.duration === 'number' && q.duration > 0 ? q.duration : 30,
    })),
    tenantId: String(doc.tenantId),
    createdBy: String(doc.createdBy),
    ...lessonFields(doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    seenStatus: ContentSeenStatus.PENDING,
    result: null,
    ...extra,
  };
}

export function serializeQuizResult(seen: {
  score?: number | null;
  totalQuestions?: number | null;
  answers?: Array<{ selectedIndex?: number | null; outcome?: string }> | null;
  attemptCount?: number | null;
  seenAt?: Date | null;
}) {
  const answers = (seen.answers ?? []).map((answer) => ({
    selectedIndex:
      typeof answer.selectedIndex === 'number' ? answer.selectedIndex : null,
    outcome:
      answer.outcome === 'correct' || answer.outcome === 'wrong' || answer.outcome === 'timedOut'
        ? answer.outcome
        : 'timedOut',
  }));
  return {
    score: seen.score ?? 0,
    totalQuestions: seen.totalQuestions ?? answers.length,
    answers,
    attemptCount: seen.attemptCount ?? 0,
    completedAt: seen.seenAt ?? null,
  };
}
