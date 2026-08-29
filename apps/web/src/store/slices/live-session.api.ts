import type { LiveSessionDto, LiveChatMessageDto } from '@/lib/types';
import { baseApi } from '../baseApi';

export const liveSessionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listLiveSessions: builder.query<{ success: boolean; data: LiveSessionDto[] }, void>({
      query: () => '/live-sessions',
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: 'LiveSession' as const, id })),
              { type: 'LiveSessions', id: 'LIST' },
            ]
          : [{ type: 'LiveSessions', id: 'LIST' }],
    }),
    getLiveSession: builder.query<{ success: boolean; data: LiveSessionDto }, string>({
      query: (id) => `/live-sessions/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'LiveSession', id }],
    }),
    createLiveSession: builder.mutation<
      { success: boolean; data: LiveSessionDto },
      { title: string; description?: string; scheduledStartTime: string; invitedUserIds?: string[] }
    >({
      query: (body) => ({
        url: '/live-sessions',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'LiveSessions', id: 'LIST' }],
    }),
    updateLiveSession: builder.mutation<
      { success: boolean; data: LiveSessionDto },
      { id: string; title?: string; description?: string; status?: 'upcoming' | 'live' | 'ended'; scheduledStartTime?: string; invitedUserIds?: string[] }
    >({
      query: ({ id, ...body }) => ({
        url: `/live-sessions/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'LiveSession', id },
        { type: 'LiveSessions', id: 'LIST' },
      ],
    }),
    deleteLiveSession: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/live-sessions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'LiveSession', id },
        { type: 'LiveSessions', id: 'LIST' },
      ],
    }),
    getChatHistory: builder.query<{ success: boolean; data: LiveChatMessageDto[] }, string>({
      query: (id) => `/live-sessions/${id}/chat`,
      providesTags: (_result, _error, id) => [{ type: 'LiveChatHistory', id }],
    }),
    postChatMessage: builder.mutation<
      { success: boolean; data: LiveChatMessageDto },
      { liveSessionId: string; message: string }
    >({
      query: ({ liveSessionId, message }) => ({
        url: `/live-sessions/${liveSessionId}/chat`,
        method: 'POST',
        body: { message },
      }),
      invalidatesTags: (_result, _error, { liveSessionId }) => [
        { type: 'LiveChatHistory', id: liveSessionId },
      ],
    }),
  }),
});

export const {
  useListLiveSessionsQuery,
  useGetLiveSessionQuery,
  useCreateLiveSessionMutation,
  useUpdateLiveSessionMutation,
  useDeleteLiveSessionMutation,
  useGetChatHistoryQuery,
  usePostChatMessageMutation,
} = liveSessionApi;
