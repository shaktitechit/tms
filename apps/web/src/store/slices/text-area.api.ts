import type { CreateTextAreaBody, TextAreaDto, UpdateTextAreaBody } from '@/lib/types';
import { baseApi } from '../baseApi';

export const textAreaApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listTextAreas: builder.query<
      { success: boolean; textAreas: TextAreaDto[] },
      { lessonId?: string } | void
    >({
      query: (arg) => {
        const lessonId = arg && typeof arg === 'object' ? arg.lessonId : undefined;
        const params = new URLSearchParams();
        if (lessonId) {
          params.set('lesson', lessonId);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/text-areas${query}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.textAreas.map(({ id }) => ({ type: 'TextArea' as const, id })),
              { type: 'TextAreas', id: 'LIST' },
            ]
          : [{ type: 'TextAreas', id: 'LIST' }],
    }),
    getTextArea: builder.query<{ success: boolean; textArea: TextAreaDto }, string>({
      query: (id) => `/text-areas/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'TextArea', id }],
    }),
    createTextArea: builder.mutation<
      { success: boolean; textArea: TextAreaDto },
      CreateTextAreaBody
    >({
      query: (body) => ({
        url: '/text-areas',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { lessonId }) => [
        { type: 'TextAreas', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        { type: 'Lesson', id: lessonId },
      ],
    }),
    updateTextArea: builder.mutation<
      { success: boolean; textArea: TextAreaDto },
      { id: string; body: UpdateTextAreaBody }
    >({
      query: ({ id, body }) => ({
        url: `/text-areas/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: 'TextArea', id },
        { type: 'TextAreas', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(result?.textArea.lessonId
          ? [{ type: 'Lesson' as const, id: result.textArea.lessonId }]
          : []),
      ],
    }),
    deleteTextArea: builder.mutation<
      { success: boolean; deleted?: boolean },
      { id: string; lessonId?: string | null }
    >({
      query: ({ id }) => ({
        url: `/text-areas/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { id, lessonId }) => [
        { type: 'TextArea', id },
        { type: 'TextAreas', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(lessonId ? [{ type: 'Lesson' as const, id: lessonId }] : []),
      ],
    }),
    markTextAreaSeen: builder.mutation<{ success: boolean; textArea: TextAreaDto }, string>({
      query: (id) => ({
        url: `/text-areas/${id}/seen`,
        method: 'POST',
      }),
      invalidatesTags: (result, _error, id) => [
        { type: 'TextArea', id },
        { type: 'TextAreas', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(result?.textArea.lessonId
          ? [{ type: 'Lesson' as const, id: result.textArea.lessonId }]
          : []),
      ],
    }),
  }),
});

export const {
  useListTextAreasQuery,
  useGetTextAreaQuery,
  useCreateTextAreaMutation,
  useUpdateTextAreaMutation,
  useDeleteTextAreaMutation,
  useMarkTextAreaSeenMutation,
} = textAreaApi;
