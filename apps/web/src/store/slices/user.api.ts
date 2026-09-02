import type { MemberProgressDto, TenantUserDto } from '@/lib/types';
import { baseApi } from '../baseApi';

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listUsers: builder.query<{ success: boolean; users: TenantUserDto[] }, void>({
      query: () => '/users',
      providesTags: (result) =>
        result
          ? [
              ...result.users.map(({ id }) => ({ type: 'User' as const, id })),
              { type: 'Users', id: 'LIST' },
            ]
          : [{ type: 'Users', id: 'LIST' }],
    }),
    getUser: builder.query<{ success: boolean; user: TenantUserDto }, string>({
      query: (id) => `/users/${id}`,
      providesTags: (_result, _error, id) => [
        { type: 'User', id },
        { type: 'Users', id: 'LIST' },
      ],
    }),
    getUserProgress: builder.query<MemberProgressDto, string>({
      query: (id) => `/users/${encodeURIComponent(id)}/progress`,
      providesTags: (_result, _error, id) => [
        { type: 'User', id },
        { type: 'Users', id: 'LIST' },
      ],
    }),
    createUser: builder.mutation<
      { success: boolean; user: TenantUserDto },
      { email: string; password: string; name: string; role?: string; access?: string; departmentIds?: string[] }
    >({
      query: (body) => ({
        url: '/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),
    updateUser: builder.mutation<
      { success: boolean; user: TenantUserDto },
      {
        id: string;
        body: {
          name?: string;
          password?: string;
          role?: string;
          access?: string;
          departmentIds?: string[];
        };
      }
    >({
      query: ({ id, body }) => ({
        url: `/users/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'User', id },
        { type: 'Users', id: 'LIST' },
        { type: 'Users', id: 'MY_LEARNERS' },
        'Me',
      ],
    }),
    deleteUser: builder.mutation<{ success: boolean; deleted?: boolean }, string>({
      query: (id) => ({
        url: `/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'User', id },
        { type: 'Users', id: 'LIST' },
      ],
    }),
    listMyLearners: builder.query<{ success: boolean; users: TenantUserDto[] }, void>({
      query: () => '/users/my-learners',
      providesTags: (result) =>
        result
          ? [
              ...result.users.map(({ id }) => ({ type: 'User' as const, id })),
              { type: 'Users', id: 'MY_LEARNERS' },
            ]
          : [{ type: 'Users', id: 'MY_LEARNERS' }],
    }),
    createLearner: builder.mutation<
      { success: boolean; user: TenantUserDto },
      { email: string; password: string; name: string; departmentIds?: string[] }
    >({
      query: (body) => ({
        url: '/users/my-learners',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Users', id: 'MY_LEARNERS' }],
    }),
  }),
});

export const {
  useListUsersQuery,
  useGetUserQuery,
  useGetUserProgressQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useListMyLearnersQuery,
  useCreateLearnerMutation,
} = userApi;
