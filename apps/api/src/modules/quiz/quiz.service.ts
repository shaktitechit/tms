import mongoose from 'mongoose';
import { AppError, ContentSeenStatus, ERROR_CODES } from '@video/shared';
import { assertCanManageCurriculum } from '../../http/access.js';
import { notFound } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import type { QuizDocument } from '../../models/index.js';
import { resolveLessonObjectId, refId } from '../content/content.utils.js';
import {
  appendLessonContentOrder,
  removeLessonContentOrder,
} from '../content/lesson-content-order.js';
import { quizSeenRepository } from './quiz-seen.repository.js';
import { serializeQuiz, serializeQuizResult } from './quiz.serializer.js';
import { quizRepository } from './quiz.repository.js';

type AuthActor = { id: string; role: string; tenantId: string; access?: string | null };

type QuestionInput = {
  prompt: string;
  options: string[];
  correctIndex: number;
  duration?: number;
};

type MarkSeenAnswerInput = { selectedIndex: number | null };

export class QuizService {
  constructor(private readonly ctx: AppContext) {}

  async list(actor: AuthActor, options?: { lesson?: string }) {
    let lessonId: string | undefined;
    if (options?.lesson) {
      lessonId = String(await this.requireLessonId(actor.tenantId, options.lesson));
    }
    const items = await quizRepository.findByTenant(actor.tenantId, lessonId);
    return this.withSeenStatus(items, actor);
  }

  async getById(actor: AuthActor, ref: string) {
    const item = await this.requireItem(actor, ref);
    const [dto] = await this.withSeenStatus([item], actor);
    return dto;
  }

  async create(
    actor: AuthActor,
    input: { title: string; description?: string; questions?: QuestionInput[]; lessonId: string },
  ) {
    assertCanManageCurriculum(actor);
    const lessonId = await this.requireLessonId(actor.tenantId, input.lessonId);
    const slug = await quizRepository.allocateSlug(actor.tenantId, input.title.trim());
    const item = await quizRepository.create({
      title: input.title.trim(),
      slug,
      description: input.description?.trim() ?? '',
      questions: (input.questions ?? []) as QuizDocument['questions'],
      lessonId,
      createdBy: new mongoose.Types.ObjectId(actor.id),
      tenantId: new mongoose.Types.ObjectId(actor.tenantId),
    });
    await item.populate('lessonId', 'name slug');
    await appendLessonContentOrder(lessonId, 'quiz', item._id);
    return serializeQuiz(item);
  }

  async update(
    actor: AuthActor,
    ref: string,
    patch: {
      title?: string;
      description?: string;
      questions?: QuestionInput[];
      lessonId?: string;
    },
  ) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireItem(actor, ref);
    const updates: Partial<QuizDocument> = {};
    if (patch.title !== undefined) {
      updates.title = patch.title.trim();
    }
    if (patch.description !== undefined) {
      updates.description = patch.description.trim();
    }
    if (patch.questions !== undefined) {
      updates.questions = patch.questions as QuizDocument['questions'];
    }
    if (patch.lessonId !== undefined) {
      updates.lessonId = await this.requireLessonId(actor.tenantId, patch.lessonId);
    }
    const updated = await quizRepository.updateById(String(existing._id), actor.tenantId, updates);
    if (!updated) {
      throw notFound('Quiz not found', ERROR_CODES.NOT_FOUND);
    }
    return serializeQuiz(updated);
  }

  async remove(actor: AuthActor, ref: string) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireItem(actor, ref);
    await removeLessonContentOrder(refId(existing.lessonId), existing._id);
    await quizSeenRepository.deleteByQuizId(String(existing._id));
    await quizRepository.deleteById(String(existing._id), actor.tenantId);
    return { deleted: true };
  }

  async markSeen(actor: AuthActor, ref: string, input: { answers: MarkSeenAnswerInput[] }) {
    const item = await this.requireItem(actor, ref);
    const questions = item.questions ?? [];
    if (questions.length === 0) {
      throw new AppError('Quiz has no questions', ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (input.answers.length !== questions.length) {
      throw new AppError(
        `Expected ${questions.length} answers`,
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }

    const graded = questions.map((question, index) => {
      const selectedIndex = input.answers[index]?.selectedIndex ?? null;
      if (selectedIndex === null) {
        return { selectedIndex: null, outcome: 'timedOut' as const };
      }
      if (selectedIndex < 0 || selectedIndex >= question.options.length) {
        throw new AppError(
          `Invalid answer for question ${index + 1}`,
          ERROR_CODES.VALIDATION_ERROR,
          400,
        );
      }
      return {
        selectedIndex,
        outcome:
          selectedIndex === question.correctIndex
            ? ('correct' as const)
            : ('wrong' as const),
      };
    });

    const score = graded.filter((answer) => answer.outcome === 'correct').length;
    const seen = await quizSeenRepository.upsertCompleted({
      quizId: item._id,
      userId: actor.id,
      tenantId: actor.tenantId,
      score,
      totalQuestions: questions.length,
      answers: graded,
    });

    return serializeQuiz(item, {
      seenStatus: ContentSeenStatus.COMPLETED,
      result: serializeQuizResult(seen),
    });
  }

  private async withSeenStatus(items: QuizDocument[], actor: AuthActor) {
    const rows = await quizSeenRepository.findByUserAndIds(
      actor.id,
      items.map((item) => item._id),
    );
    const byQuizId = new Map(rows.map((row) => [String(row.quizId), row]));
    return items.map((item) => {
      const seen = byQuizId.get(String(item._id));
      if (!seen || seen.status !== ContentSeenStatus.COMPLETED) {
        return serializeQuiz(item);
      }
      return serializeQuiz(item, {
        seenStatus: ContentSeenStatus.COMPLETED,
        result: serializeQuizResult(seen),
      });
    });
  }

  private async requireItem(actor: AuthActor, ref: string) {
    const item = await quizRepository.findByRef(ref, actor.tenantId);
    if (!item) {
      throw notFound('Quiz not found', ERROR_CODES.NOT_FOUND);
    }
    if (!item.slug) {
      item.slug = await quizRepository.allocateSlug(actor.tenantId, item.title);
      await item.save();
    }
    return item;
  }

  private async requireLessonId(tenantId: string, lessonRef: string) {
    const lesson = await resolveLessonObjectId(tenantId, lessonRef);
    if (!lesson) {
      throw notFound('Lesson not found', ERROR_CODES.NOT_FOUND);
    }
    return lesson._id;
  }
}
