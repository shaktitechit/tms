import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const quizQuestionSchema = new mongoose.Schema(
  {
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length >= 2,
        message: 'Each question needs at least two options',
      },
    },
    correctIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Time limit for this question in seconds. */
    duration: {
      type: Number,
      min: 1,
      default: 30,
    },
  },
  { _id: false },
);

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      trim: true,
      maxlength: 80,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: 5000,
    },
    questions: {
      type: [quizQuestionSchema],
      default: [],
    },
    createdBy: {
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
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

quizSchema.index(
  { tenantId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' } } },
);
quizSchema.index({ tenantId: 1, lessonId: 1, createdAt: -1 });

export type QuizDocument = InferSchemaType<typeof quizSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Quiz: Model<QuizDocument> =
  mongoose.models.Quiz ?? mongoose.model<QuizDocument>('Quiz', quizSchema);
