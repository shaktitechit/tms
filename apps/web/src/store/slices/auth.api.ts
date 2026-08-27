import type { AuthUser } from '@/lib/types';
import { baseApi } from '../baseApi';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    me: builder.query<{ success: boolean; user: AuthUser | null }, void>({
      async queryFn(_arg, _api, _extraOptions, baseQuery) {
        const result = await baseQuery('/auth/me');
        if (result.error) {
          const status = 'status' in result.error ? result.error.status : undefined;
          if (status === 401) {
            return { data: { success: false, user: null } };
          }
          return { error: result.error };
        }
        return { data: result.data as { success: boolean; user: AuthUser } };
      },
      providesTags: ['Me'],
    }),
    login: builder.mutation<
      { success: boolean; user: AuthUser },
      { email: string; password: string }
    >({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Me', 'Tenant', 'Users', 'Videos', 'Discussions'],
    }),
    register: builder.mutation<
      { success: boolean; user: AuthUser },
      { email: string; password: string; name: string; tenantName?: string }
    >({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Me', 'Tenant', 'Users', 'Videos', 'Discussions'],
    }),
    logout: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: [
        'Me',
        'Tenant',
        'Users',
        'User',
        'Videos',
        'Video',
        'Discussions',
        'Discussion',
      ],
    }),
  }),
});

export const {
  useMeQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
} = authApi;
