import type { LessonContentOrderItem, LessonDto } from '@/lib/types';
import { baseApi } from '../baseApi';

export type LessonFormInput = {
  name: string;
  description?: string;
  authorName: string;
  authorEmail: string;
  moduleId: string;
  thumbnail?: File | null;
};

function toFormData(input: LessonFormInput): FormData {
  const form = new FormData();
  form.append('name', input.name);
  form.append('description', input.description ?? '');
  form.append('authorName', input.authorName);
  form.append('authorEmail', input.authorEmail);
  form.append('moduleId', input.moduleId);
  if (input.thumbnail) {
    form.append('thumbnail', input.thumbnail);
  }
  return form;
}

export const lessonApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listLessons: builder.query<
      { success: boolean; lessons: LessonDto[] },
      { moduleId?: string } | void
    >({
      query: (arg) => {
        const moduleId = arg && typeof arg === 'object' ? arg.moduleId : undefined;
        const params = new URLSearchParams();
        if (moduleId) {
          params.set('module', moduleId);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/lessons${query}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.lessons.map(({ id }) => ({ type: 'Lesson' as const, id })),
              { type: 'Lessons', id: 'LIST' },
            ]
          : [{ type: 'Lessons', id: 'LIST' }],
    }),
    getLesson: builder.query<{ success: boolean; lesson: LessonDto }, string>({
      query: (id) => `/lessons/${id}`,
      providesTags: (result, _error, arg) => {
        const tags: Array<{ type: 'Lesson'; id: string }> = [{ type: 'Lesson', id: arg }];
        if (result?.lesson?.id) {
          tags.push({ type: 'Lesson', id: result.lesson.id });
        }
        if (result?.lesson?.slug && result.lesson.slug !== arg) {
          tags.push({ type: 'Lesson', id: result.lesson.slug });
        }
        return tags;
      },
    }),
    createLesson: builder.mutation<{ success: boolean; lesson: LessonDto }, LessonFormInput>({
      query: (input) => ({
        url: '/lessons',
        method: 'POST',
        body: toFormData(input),
      }),
      invalidatesTags: [{ type: 'Lessons', id: 'LIST' }, { type: 'Modules', id: 'LIST' }],
    }),
    updateLesson: builder.mutation<
      { success: boolean; lesson: LessonDto },
      { id: string; body: LessonFormInput }
    >({
      query: ({ id, body }) => ({
        url: `/lessons/${id}`,
        method: 'PATCH',
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Lesson', id },
        { type: 'Lessons', id: 'LIST' },
        { type: 'Modules', id: 'LIST' },
      ],
    }),
    deleteLesson: builder.mutation<{ success: boolean; deleted?: boolean }, string>({
      query: (id) => ({
        url: `/lessons/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Lesson', id },
        { type: 'Lessons', id: 'LIST' },
        { type: 'Modules', id: 'LIST' },
      ],
    }),
    reorderLessonContent: builder.mutation<
      { success: boolean; contentOrder: LessonContentOrderItem[] },
      { lessonId: string; items: LessonContentOrderItem[] }
    >({
      query: ({ lessonId, items }) => ({
        url: `/lessons/${lessonId}/content-order`,
        method: 'PUT',
        body: { items },
      }),
      invalidatesTags: (_result, _error, { lessonId }) => [{ type: 'Lesson', id: lessonId }],
    }),
    reorderLessons: builder.mutation<
      { success: boolean; lessons: LessonDto[] },
      { moduleId: string; ids: string[] }
    >({
      query: (body) => ({
        url: '/lessons/order',
        method: 'PUT',
        body,
      }),
      invalidatesTags: [{ type: 'Lessons', id: 'LIST' }, { type: 'Modules', id: 'LIST' }],
    }),
  }),
});

export const {
  useListLessonsQuery,
  useGetLessonQuery,
  useCreateLessonMutation,
  useUpdateLessonMutation,
  useDeleteLessonMutation,
  useReorderLessonContentMutation,
  useReorderLessonsMutation,
} = lessonApi;
