import mongoose from 'mongoose';
import { ContentSeenStatus } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';

export type QuizSeenAnswerInput = {
  selectedIndex: number | null;
  outcome: 'correct' | 'wrong' | 'timedOut';
};

export const quizSeenRepository = {
  findCompletedByUserAndIds(userId: string, ids: mongoose.Types.ObjectId[]) {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return mongoRegistry.models.QuizSeen.find({
      userId,
      quizId: { $in: ids },
      status: ContentSeenStatus.COMPLETED,
    }).lean();
  },

  findByUserAndIds(userId: string, ids: mongoose.Types.ObjectId[]) {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return mongoRegistry.models.QuizSeen.find({
      userId,
      quizId: { $in: ids },
    }).lean();
  },

  upsertCompleted(input: {
    quizId: mongoose.Types.ObjectId;
    userId: string;
    tenantId: string;
    score: number;
    totalQuestions: number;
    answers: QuizSeenAnswerInput[];
  }) {
    return mongoRegistry.models.QuizSeen.findOneAndUpdate(
      { userId: input.userId, quizId: input.quizId },
      {
        $set: {
          status: ContentSeenStatus.COMPLETED,
          tenantId: input.tenantId,
          seenAt: new Date(),
          score: input.score,
          totalQuestions: input.totalQuestions,
          answers: input.answers,
        },
        $inc: { attemptCount: 1 },
        $setOnInsert: {
          userId: input.userId,
          quizId: input.quizId,
        },
      },
      { upsert: true, new: true },
    );
  },

  deleteByQuizId(quizId: string) {
    return mongoRegistry.models.QuizSeen.deleteMany({ quizId });
  },
};
