import type { ModuleDto } from '@/lib/types';
import { baseApi } from '../baseApi';

export type ModuleFormInput = {
  name: string;
  description?: string;
  authorName: string;
  authorEmail: string;
  departmentId?: string | null;
  thumbnail?: File | null;
};

function toFormData(input: ModuleFormInput): FormData {
  const form = new FormData();
  form.append('name', input.name);
  form.append('description', input.description ?? '');
  form.append('authorName', input.authorName);
  form.append('authorEmail', input.authorEmail);
  if (input.departmentId) {
    form.append('departmentId', input.departmentId);
  }
  if (input.thumbnail) {
    form.append('thumbnail', input.thumbnail);
  }
  return form;
}

export const moduleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listModules: builder.query<
      { success: boolean; modules: ModuleDto[] },
      { departmentId?: string } | void
    >({
      query: (arg) => {
        const departmentId = arg && typeof arg === 'object' ? arg.departmentId : undefined;
        const params = new URLSearchParams();
        if (departmentId) {
          params.set('department', departmentId);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/modules${query}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.modules.map(({ id }) => ({ type: 'Module' as const, id })),
              { type: 'Modules', id: 'LIST' },
            ]
          : [{ type: 'Modules', id: 'LIST' }],
    }),
    getModule: builder.query<{ success: boolean; module: ModuleDto }, string>({
      query: (id) => `/modules/${id}`,
      providesTags: (result, _error, id) =>
        result
          ? [
              { type: 'Module', id },
              { type: 'Module', id: result.module.id },
              { type: 'Module', id: result.module.slug },
            ]
          : [{ type: 'Module', id }],
    }),
    createModule: builder.mutation<
      { success: boolean; module: ModuleDto },
      ModuleFormInput
    >({
      query: (input) => ({
        url: '/modules',
        method: 'POST',
        body: toFormData(input),
      }),
      invalidatesTags: [
        { type: 'Modules', id: 'LIST' },
        { type: 'Departments', id: 'LIST' },
        { type: 'Users', id: 'LIST' },
        'User',
        'MemberModules',
        'MemberModule',
      ],
    }),
    updateModule: builder.mutation<
      { success: boolean; module: ModuleDto },
      { id: string; body: ModuleFormInput }
    >({
      query: ({ id, body }) => ({
        url: `/modules/${id}`,
        method: 'PATCH',
        body: toFormData(body),
      }),
      invalidatesTags: (result, _error, { id }) => [
        { type: 'Module', id },
        ...(result
          ? [
              { type: 'Module' as const, id: result.module.id },
              { type: 'Module' as const, id: result.module.slug },
            ]
          : []),
        { type: 'Modules', id: 'LIST' },
        { type: 'Departments', id: 'LIST' },
      ],
    }),
    deleteModule: builder.mutation<{ success: boolean; deleted?: boolean }, string>({
      query: (id) => ({
        url: `/modules/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Module', id },
        { type: 'Modules', id: 'LIST' },
        { type: 'Departments', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListModulesQuery,
  useGetModuleQuery,
  useCreateModuleMutation,
  useUpdateModuleMutation,
  useDeleteModuleMutation,
} = moduleApi;
