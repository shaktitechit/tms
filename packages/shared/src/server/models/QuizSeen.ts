import mongoose, { type InferSchemaType, type Model } from 'mongoose';
import { ContentSeenStatus } from '../../types.js';

const quizSeenAnswerSchema = new mongoose.Schema(
  {
    selectedIndex: {
      type: Number,
      default: null,
    },
    outcome: {
      type: String,
      enum: ['correct', 'wrong', 'timedOut'],
      required: true,
    },
  },
  { _id: false },
);

const quizSeenSchema = new mongoose.Schema(
  {
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ContentSeenStatus),
      default: ContentSeenStatus.PENDING,
      index: true,
    },
    seenAt: {
      type: Date,
    },
    score: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      min: 0,
      default: 0,
    },
    answers: {
      type: [quizSeenAnswerSchema],
      default: [],
    },
    attemptCount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true },
);

quizSeenSchema.index({ userId: 1, quizId: 1 }, { unique: true });
quizSeenSchema.index({ tenantId: 1, userId: 1, status: 1 });

export type QuizSeenDocument = InferSchemaType<typeof quizSeenSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const QuizSeen: Model<QuizSeenDocument> =
  mongoose.models.QuizSeen ?? mongoose.model<QuizSeenDocument>('QuizSeen', quizSeenSchema);
