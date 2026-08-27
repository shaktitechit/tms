import type { CreateDiscussionBody, DiscussionDto } from '@/lib/types';
import { baseApi } from '../baseApi';

type ListDiscussionsArg = {
  videoId?: string;
  lessonId?: string;
  parentId?: string;
};

function discussionScopeId(arg: { videoId?: string | null; lessonId?: string | null }) {
  return arg.videoId ?? arg.lessonId ?? 'LIST';
}

export const discussionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listDiscussions: builder.query<
      { success: boolean; discussions: DiscussionDto[] },
      ListDiscussionsArg
    >({
      query: ({ videoId, lessonId, parentId }) => {
        const params = new URLSearchParams();
        if (videoId) {
          params.set('videoId', videoId);
        }
        if (lessonId) {
          params.set('lessonId', lessonId);
        }
        if (parentId) {
          params.set('parentId', parentId);
        }
        return `/discussions?${params.toString()}`;
      },
      providesTags: (result, _error, arg) => {
        const scopeId = discussionScopeId(arg);
        return result
          ? [
              ...result.discussions.map(({ id }) => ({ type: 'Discussion' as const, id })),
              { type: 'Discussions', id: 'LIST' },
              { type: 'Discussions', id: scopeId },
            ]
          : [
              { type: 'Discussions', id: 'LIST' },
              { type: 'Discussions', id: scopeId },
            ];
      },
    }),
    getDiscussion: builder.query<{ success: boolean; discussion: DiscussionDto }, string>({
      query: (id) => `/discussions/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Discussion', id }],
    }),
    createDiscussion: builder.mutation<
      { success: boolean; discussion: DiscussionDto },
      CreateDiscussionBody
    >({
      query: (body) => ({
        url: '/discussions',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'Discussions', id: 'LIST' },
        { type: 'Discussions', id: discussionScopeId(arg) },
      ],
    }),
    updateDiscussion: builder.mutation<
      { success: boolean; discussion: DiscussionDto },
      { id: string; body: string }
    >({
      query: ({ id, body }) => ({
        url: `/discussions/${id}`,
        method: 'PATCH',
        body: { body },
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: 'Discussion', id },
        { type: 'Discussions', id: 'LIST' },
        ...(result?.discussion.videoId
          ? [{ type: 'Discussions' as const, id: result.discussion.videoId }]
          : []),
        ...(result?.discussion.lessonId
          ? [{ type: 'Discussions' as const, id: result.discussion.lessonId }]
          : []),
      ],
    }),
    deleteDiscussion: builder.mutation<{ success: boolean; deleted?: boolean }, string>({
      query: (id) => ({
        url: `/discussions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Discussion', id },
        { type: 'Discussions', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListDiscussionsQuery,
  useGetDiscussionQuery,
  useCreateDiscussionMutation,
  useUpdateDiscussionMutation,
  useDeleteDiscussionMutation,
} = discussionApi;
