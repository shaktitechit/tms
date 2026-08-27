import type { UpdateVideoBody, VideoDto, VideoStatusDto } from '@/lib/types';
import { baseApi } from '../baseApi';
import { managedVideosPath } from '../utils';

export const videoApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listVideos: builder.query<
      { success: boolean; videos: VideoDto[] },
      | { status?: string; role?: string | null; moduleId?: string; lessonId?: string }
      | string
      | undefined
    >({
      query: (arg) => {
        const status = typeof arg === 'string' ? arg : arg?.status;
        const role = typeof arg === 'object' && arg ? arg.role : undefined;
        const moduleId = typeof arg === 'object' && arg ? arg.moduleId : undefined;
        const lessonId = typeof arg === 'object' && arg ? arg.lessonId : undefined;
        const params = new URLSearchParams();
        if (status && status !== 'ALL') {
          params.set('status', status);
        }
        if (moduleId) {
          params.set('module', moduleId);
        }
        if (lessonId) {
          params.set('lesson', lessonId);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        const base = role ? managedVideosPath(role) : '/videos';
        return `${base}${query}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.videos.map(({ id }) => ({ type: 'Video' as const, id })),
              { type: 'Videos', id: 'LIST' },
            ]
          : [{ type: 'Videos', id: 'LIST' }],
    }),
    getVideo: builder.query<
      { success: boolean; video: VideoDto },
      { id: string; role?: string | null } | string
    >({
      query: (arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        const role = typeof arg === 'object' ? arg.role : undefined;
        const base = role ? managedVideosPath(role) : '/videos';
        return `${base}/${id}`;
      },
      providesTags: (_result, _error, arg) => [
        { type: 'Video', id: typeof arg === 'string' ? arg : arg.id },
      ],
    }),
    getVideoStatus: builder.query<
      VideoStatusDto,
      { id: string; role?: string | null } | string
    >({
      query: (arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        const role = typeof arg === 'object' ? arg.role : undefined;
        const base = role ? managedVideosPath(role) : '/videos';
        return `${base}/${id}/status`;
      },
      providesTags: (_result, _error, arg) => [
        { type: 'Video', id: typeof arg === 'string' ? arg : arg.id },
      ],
    }),
    updateVideo: builder.mutation<
      { success: boolean; video: VideoDto },
      {
        id: string;
        body: UpdateVideoBody;
        role?: string | null;
        /** Lesson to refresh when unlinking or when response lessonId is missing. */
        invalidateLessonId?: string | null;
      }
    >({
      query: ({ id, body, role }) => ({
        url: `${managedVideosPath(role)}/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result, _error, { id, body, invalidateLessonId }) => {
        const lessonIds = new Set<string>();
        if (result?.video.lessonId) {
          lessonIds.add(result.video.lessonId);
        }
        if (invalidateLessonId) {
          lessonIds.add(invalidateLessonId);
        }
        if (typeof body.lessonId === 'string' && body.lessonId) {
          lessonIds.add(body.lessonId);
        }
        return [
          { type: 'Video', id },
          { type: 'Videos', id: 'LIST' },
          ...[...lessonIds].map((lessonId) => ({ type: 'Lesson' as const, id: lessonId })),
        ];
      },
    }),
    deleteVideo: builder.mutation<
      { success: boolean },
      { id: string; role?: string | null; lessonId?: string | null } | string
    >({
      query: (arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        const role = typeof arg === 'object' ? arg.role : undefined;
        return {
          url: `${managedVideosPath(role)}/${id}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: (_result, _error, arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        const lessonId = typeof arg === 'object' ? arg.lessonId : undefined;
        return [
          { type: 'Video', id },
          { type: 'Videos', id: 'LIST' },
          ...(lessonId ? [{ type: 'Lesson' as const, id: lessonId }] : []),
        ];
      },
    }),
    markVideoSeen: builder.mutation<
      { success: boolean; video: VideoDto },
      { id: string; role?: string | null }
    >({
      query: ({ id, role }) => ({
        url: `${managedVideosPath(role)}/${id}/seen`,
        method: 'POST',
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: 'Video', id },
        { type: 'Videos', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(result?.video.lessonId
          ? [{ type: 'Lesson' as const, id: result.video.lessonId }]
          : []),
      ],
    }),
    uploadVideo: builder.mutation<
      { success: boolean; video: VideoDto },
      { body: FormData; role?: string | null }
    >({
      query: ({ body, role }) => ({
        url: managedVideosPath(role),
        method: 'POST',
        body,
      }),
      invalidatesTags: (result) => [
        { type: 'Videos', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(result?.video.lessonId
          ? [{ type: 'Lesson' as const, id: result.video.lessonId }]
          : []),
      ],
    }),
  }),
});

export const {
  useListVideosQuery,
  useGetVideoQuery,
  useGetVideoStatusQuery,
  useLazyGetVideoStatusQuery,
  useUpdateVideoMutation,
  useDeleteVideoMutation,
  useUploadVideoMutation,
  useMarkVideoSeenMutation,
} = videoApi;
