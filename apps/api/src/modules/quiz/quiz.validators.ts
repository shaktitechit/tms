import { z } from 'zod';

const questionSchema = z
  .object({
    prompt: z.string().min(1).max(1000),
    options: z.array(z.string().min(1)).min(2),
    correctIndex: z.number().int().min(0),
    duration: z.number().int().min(1).max(3600).default(30),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: 'correctIndex must be within options',
  });

export const createQuizSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(''),
  questions: z.array(questionSchema).default([]),
  lessonId: z.string().min(1),
});

export const updateQuizSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    questions: z.array(questionSchema).optional(),
    lessonId: z.string().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const markQuizSeenSchema = z.object({
  answers: z
    .array(
      z.object({
        selectedIndex: z.number().int().min(0).nullable(),
      }),
    )
    .min(1),
});
