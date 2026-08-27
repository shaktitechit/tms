import type { TenantDto } from '@/lib/types';
import { baseApi } from '../baseApi';

export type UpdateTenantMeInput = {
  name: string;
  logo?: File | null;
};

function toFormData(input: UpdateTenantMeInput): FormData {
  const form = new FormData();
  form.append('name', input.name);
  if (input.logo) {
    form.append('logo', input.logo);
  }
  return form;
}

export const tenantApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTenantMe: builder.query<{ success: boolean; tenant: TenantDto }, void>({
      query: () => '/tenants/me',
      providesTags: ['Tenant'],
    }),
    updateTenantMe: builder.mutation<{ success: boolean; tenant: TenantDto }, UpdateTenantMeInput>({
      query: (input) => ({
        url: '/tenants/me',
        method: 'PATCH',
        body: toFormData(input),
      }),
      invalidatesTags: ['Tenant'],
    }),
  }),
});

export const { useGetTenantMeQuery, useUpdateTenantMeMutation } = tenantApi;
