import type { DepartmentDto } from '@/lib/types';
import { baseApi } from '../baseApi';

export type DepartmentFormInput = {
  name: string;
  description?: string;
  thumbnail?: File | null;
};

function toFormData(input: DepartmentFormInput): FormData {
  const form = new FormData();
  form.append('name', input.name);
  form.append('description', input.description ?? '');
  if (input.thumbnail) {
    form.append('thumbnail', input.thumbnail);
  }
  return form;
}

export const departmentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listDepartments: builder.query<{ success: boolean; departments: DepartmentDto[] }, void>({
      query: () => '/departments',
      providesTags: (result) =>
        result
          ? [
              ...result.departments.map(({ id }) => ({ type: 'Department' as const, id })),
              { type: 'Departments', id: 'LIST' },
            ]
          : [{ type: 'Departments', id: 'LIST' }],
    }),
    getDepartment: builder.query<{ success: boolean; department: DepartmentDto }, string>({
      query: (id) => `/departments/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Department', id }],
    }),
    createDepartment: builder.mutation<
      { success: boolean; department: DepartmentDto },
      DepartmentFormInput
    >({
      query: (input) => ({
        url: '/departments',
        method: 'POST',
        body: toFormData(input),
      }),
      invalidatesTags: [{ type: 'Departments', id: 'LIST' }],
    }),
    updateDepartment: builder.mutation<
      { success: boolean; department: DepartmentDto },
      { id: string; body: DepartmentFormInput }
    >({
      query: ({ id, body }) => ({
        url: `/departments/${id}`,
        method: 'PATCH',
        body: toFormData(body),
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Department', id },
        { type: 'Departments', id: 'LIST' },
      ],
    }),
    deleteDepartment: builder.mutation<{ success: boolean; deleted?: boolean }, string>({
      query: (id) => ({
        url: `/departments/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Department', id },
        { type: 'Departments', id: 'LIST' },
        { type: 'Modules', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListDepartmentsQuery,
  useGetDepartmentQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
} = departmentApi;
