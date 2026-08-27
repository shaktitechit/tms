import type { AudioDto, AudioFormInput, AudioStatusDto, UpdateAudioBody } from '@/lib/types';
import { baseApi } from '../baseApi';

function toFormData(input: AudioFormInput, requireFile: boolean): FormData {
  const form = new FormData();
  form.append('title', input.title);
  form.append('description', input.description ?? '');
  if (input.lessonId) {
    form.append('lessonId', input.lessonId);
  }
  if (input.file) {
    form.append('fileSize', String(input.file.size));
    form.append('file', input.file);
  } else if (requireFile) {
    throw new Error('Audio file is required');
  }
  return form;
}

export const audioApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listAudios: builder.query<
      { success: boolean; audios: AudioDto[] },
      { lessonId?: string } | void
    >({
      query: (arg) => {
        const lessonId = arg && typeof arg === 'object' ? arg.lessonId : undefined;
        const params = new URLSearchParams();
        if (lessonId) {
          params.set('lesson', lessonId);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/audios${query}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.audios.map(({ id }) => ({ type: 'Audio' as const, id })),
              { type: 'Audios', id: 'LIST' },
            ]
          : [{ type: 'Audios', id: 'LIST' }],
    }),
    getAudio: builder.query<{ success: boolean; audio: AudioDto }, string>({
      query: (id) => `/audios/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Audio', id }],
    }),
    getAudioStatus: builder.query<AudioStatusDto, string>({
      query: (id) => `/audios/${id}/status`,
      providesTags: (_result, _error, id) => [{ type: 'Audio', id }],
    }),
    createAudio: builder.mutation<{ success: boolean; audio: AudioDto }, AudioFormInput>({
      query: (input) => ({
        url: '/audios',
        method: 'POST',
        body: toFormData(input, true),
      }),
      invalidatesTags: (_result, _error, { lessonId }) => [
        { type: 'Audios', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(lessonId ? [{ type: 'Lesson' as const, id: lessonId }] : []),
      ],
    }),
    updateAudio: builder.mutation<
      { success: boolean; audio: AudioDto },
      {
        id: string;
        body: UpdateAudioBody | AudioFormInput;
        invalidateLessonId?: string | null;
      }
    >({
      query: ({ id, body }) => {
        if ('file' in body && body.file) {
          return {
            url: `/audios/${id}`,
            method: 'PATCH',
            body: toFormData(body as AudioFormInput, false),
          };
        }
        const jsonBody: UpdateAudioBody =
          'file' in body
            ? {
                title: body.title,
                description: body.description,
                lessonId: body.lessonId,
              }
            : body;
        return {
          url: `/audios/${id}`,
          method: 'PATCH',
          body: jsonBody,
        };
      },
      invalidatesTags: (result, _error, { id, body, invalidateLessonId }) => {
        const lessonIds = new Set<string>();
        if (result?.audio.lessonId) {
          lessonIds.add(result.audio.lessonId);
        }
        if (invalidateLessonId) {
          lessonIds.add(invalidateLessonId);
        }
        if (typeof body.lessonId === 'string' && body.lessonId) {
          lessonIds.add(body.lessonId);
        }
        return [
          { type: 'Audio', id },
          { type: 'Audios', id: 'LIST' },
          { type: 'Lessons', id: 'LIST' },
          ...[...lessonIds].map((lessonId) => ({ type: 'Lesson' as const, id: lessonId })),
        ];
      },
    }),
    deleteAudio: builder.mutation<
      { success: boolean; deleted?: boolean },
      { id: string; lessonId?: string | null }
    >({
      query: ({ id }) => ({
        url: `/audios/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { id, lessonId }) => [
        { type: 'Audio', id },
        { type: 'Audios', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(lessonId ? [{ type: 'Lesson' as const, id: lessonId }] : []),
      ],
    }),
    markAudioSeen: builder.mutation<{ success: boolean; audio: AudioDto }, string>({
      query: (id) => ({
        url: `/audios/${id}/seen`,
        method: 'POST',
      }),
      invalidatesTags: (result, _error, id) => [
        { type: 'Audio', id },
        { type: 'Audios', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(result?.audio.lessonId
          ? [{ type: 'Lesson' as const, id: result.audio.lessonId }]
          : []),
      ],
    }),
  }),
});

export const {
  useListAudiosQuery,
  useGetAudioQuery,
  useGetAudioStatusQuery,
  useLazyGetAudioStatusQuery,
  useCreateAudioMutation,
  useUpdateAudioMutation,
  useDeleteAudioMutation,
  useMarkAudioSeenMutation,
} = audioApi;
