import type { ImageDto, ImageFormInput, UpdateImageBody } from '@/lib/types';
import { baseApi } from '../baseApi';

function toFormData(input: ImageFormInput, requireFile: boolean): FormData {
  const form = new FormData();
  form.append('title', input.title);
  form.append('description', input.description ?? '');
  form.append('lessonId', input.lessonId);
  if (input.width !== undefined) {
    form.append('width', String(input.width));
  }
  if (input.height !== undefined) {
    form.append('height', String(input.height));
  }
  if (input.duration !== undefined && input.duration !== null) {
    form.append('duration', String(input.duration));
  } else if (input.duration === null) {
    form.append('duration', '');
  }
  if (input.file) {
    form.append('fileSize', String(input.file.size));
    form.append('file', input.file);
  } else if (requireFile) {
    throw new Error('Image file is required');
  }
  return form;
}

export const imageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listImages: builder.query<
      { success: boolean; images: ImageDto[] },
      { lessonId?: string } | void
    >({
      query: (arg) => {
        const lessonId = arg && typeof arg === 'object' ? arg.lessonId : undefined;
        const params = new URLSearchParams();
        if (lessonId) {
          params.set('lesson', lessonId);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/images${query}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.images.map(({ id }) => ({ type: 'Image' as const, id })),
              { type: 'Images', id: 'LIST' },
            ]
          : [{ type: 'Images', id: 'LIST' }],
    }),
    getImage: builder.query<{ success: boolean; image: ImageDto }, string>({
      query: (id) => `/images/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Image', id }],
    }),
    createImage: builder.mutation<{ success: boolean; image: ImageDto }, ImageFormInput>({
      query: (input) => ({
        url: '/images',
        method: 'POST',
        body: toFormData(input, true),
      }),
      invalidatesTags: (_result, _error, { lessonId }) => [
        { type: 'Images', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        { type: 'Lesson', id: lessonId },
      ],
    }),
    updateImage: builder.mutation<
      { success: boolean; image: ImageDto },
      {
        id: string;
        body: UpdateImageBody | ImageFormInput;
        invalidateLessonId?: string | null;
      }
    >({
      query: ({ id, body }) => {
        if ('file' in body && body.file) {
          return {
            url: `/images/${id}`,
            method: 'PATCH',
            body: toFormData(body as ImageFormInput, false),
          };
        }
        const jsonBody: UpdateImageBody =
          'file' in body
            ? {
                title: body.title,
                description: body.description,
                lessonId: body.lessonId,
                width: body.width,
                height: body.height,
                duration: body.duration,
              }
            : body;
        return {
          url: `/images/${id}`,
          method: 'PATCH',
          body: jsonBody,
        };
      },
      invalidatesTags: (result, _error, { id, invalidateLessonId }) => [
        { type: 'Image', id },
        { type: 'Images', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(result?.image.lessonId
          ? [{ type: 'Lesson' as const, id: result.image.lessonId }]
          : []),
        ...(invalidateLessonId ? [{ type: 'Lesson' as const, id: invalidateLessonId }] : []),
      ],
    }),
    deleteImage: builder.mutation<
      { success: boolean; deleted?: boolean },
      { id: string; lessonId?: string | null }
    >({
      query: ({ id }) => ({
        url: `/images/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { id, lessonId }) => [
        { type: 'Image', id },
        { type: 'Images', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(lessonId ? [{ type: 'Lesson' as const, id: lessonId }] : []),
      ],
    }),
    markImageSeen: builder.mutation<{ success: boolean; image: ImageDto }, string>({
      query: (id) => ({
        url: `/images/${id}/seen`,
        method: 'POST',
      }),
      invalidatesTags: (result, _error, id) => [
        { type: 'Image', id },
        { type: 'Images', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(result?.image.lessonId
          ? [{ type: 'Lesson' as const, id: result.image.lessonId }]
          : []),
      ],
    }),
  }),
});

export const {
  useListImagesQuery,
  useGetImageQuery,
  useCreateImageMutation,
  useUpdateImageMutation,
  useDeleteImageMutation,
  useMarkImageSeenMutation,
} = imageApi;
