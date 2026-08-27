import type { CreateQuizBody, MarkQuizSeenBody, QuizDto, UpdateQuizBody } from '@/lib/types';
import { baseApi } from '../baseApi';

export const quizApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listQuizzes: builder.query<
      { success: boolean; quizzes: QuizDto[] },
      { lessonId?: string } | void
    >({
      query: (arg) => {
        const lessonId = arg && typeof arg === 'object' ? arg.lessonId : undefined;
        const params = new URLSearchParams();
        if (lessonId) {
          params.set('lesson', lessonId);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/quizzes${query}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.quizzes.map(({ id }) => ({ type: 'Quiz' as const, id })),
              { type: 'Quizzes', id: 'LIST' },
            ]
          : [{ type: 'Quizzes', id: 'LIST' }],
    }),
    getQuiz: builder.query<{ success: boolean; quiz: QuizDto }, string>({
      query: (id) => `/quizzes/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Quiz', id }],
    }),
    createQuiz: builder.mutation<{ success: boolean; quiz: QuizDto }, CreateQuizBody>({
      query: (body) => ({
        url: '/quizzes',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { lessonId }) => [
        { type: 'Quizzes', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        { type: 'Lesson', id: lessonId },
      ],
    }),
    updateQuiz: builder.mutation<
      { success: boolean; quiz: QuizDto },
      { id: string; body: UpdateQuizBody }
    >({
      query: ({ id, body }) => ({
        url: `/quizzes/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: 'Quiz', id },
        { type: 'Quizzes', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(result?.quiz.lessonId ? [{ type: 'Lesson' as const, id: result.quiz.lessonId }] : []),
      ],
    }),
    deleteQuiz: builder.mutation<
      { success: boolean; deleted?: boolean },
      { id: string; lessonId?: string | null }
    >({
      query: ({ id }) => ({
        url: `/quizzes/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { id, lessonId }) => [
        { type: 'Quiz', id },
        { type: 'Quizzes', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(lessonId ? [{ type: 'Lesson' as const, id: lessonId }] : []),
      ],
    }),
    markQuizSeen: builder.mutation<
      { success: boolean; quiz: QuizDto },
      { id: string; body: MarkQuizSeenBody }
    >({
      query: ({ id, body }) => ({
        url: `/quizzes/${id}/seen`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: 'Quiz', id },
        { type: 'Quizzes', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(result?.quiz.lessonId ? [{ type: 'Lesson' as const, id: result.quiz.lessonId }] : []),
      ],
    }),
  }),
});

export const {
  useListQuizzesQuery,
  useGetQuizQuery,
  useCreateQuizMutation,
  useUpdateQuizMutation,
  useDeleteQuizMutation,
  useMarkQuizSeenMutation,
} = quizApi;
