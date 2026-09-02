import type { MemberModuleDto } from '@/lib/types';
import { baseApi } from '../baseApi';

export const memberModuleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listMemberModules: builder.query<
      { success: boolean; memberModules: MemberModuleDto[] },
      string
    >({
      query: (userId) => `/member-modules?userId=${encodeURIComponent(userId)}`,
      providesTags: (result, _error, userId) =>
        result
          ? [
              ...result.memberModules.map(({ id }) => ({ type: 'MemberModule' as const, id })),
              { type: 'MemberModules', id: userId },
              { type: 'MemberModules', id: 'LIST' },
            ]
          : [{ type: 'MemberModules', id: userId }],
    }),
    getMemberModule: builder.query<{ success: boolean; memberModule: MemberModuleDto }, string>({
      query: (id) => `/member-modules/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'MemberModule', id }],
    }),
    createMemberModule: builder.mutation<
      { success: boolean; memberModule: MemberModuleDto },
      { userId: string; moduleId: string }
    >({
      query: (body) => ({
        url: '/member-modules',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'MemberModules', id: userId },
        { type: 'MemberModules', id: 'LIST' },
        { type: 'Users', id: 'LIST' },
        { type: 'User', id: userId },
      ],
    }),
    replaceMemberModules: builder.mutation<
      { success: boolean; memberModules: MemberModuleDto[] },
      { userId: string; moduleIds: string[] }
    >({
      query: (body) => ({
        url: '/member-modules',
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        { type: 'MemberModules', id: userId },
        { type: 'MemberModules', id: 'LIST' },
        { type: 'Users', id: 'LIST' },
        { type: 'Users', id: 'MY_LEARNERS' },
        { type: 'User', id: userId },
      ],
    }),
    deleteMemberModule: builder.mutation<{ success: boolean; deleted?: boolean }, string>({
      query: (id) => ({
        url: `/member-modules/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'MemberModule', id },
        { type: 'MemberModules', id: 'LIST' },
        { type: 'Users', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListMemberModulesQuery,
  useGetMemberModuleQuery,
  useCreateMemberModuleMutation,
  useReplaceMemberModulesMutation,
  useDeleteMemberModuleMutation,
} = memberModuleApi;
