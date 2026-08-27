import type { PdfDto, PdfFormInput, UpdatePdfBody } from '@/lib/types';
import { baseApi } from '../baseApi';

function toFormData(input: PdfFormInput, requireFile: boolean): FormData {
  const form = new FormData();
  form.append('title', input.title);
  form.append('description', input.description ?? '');
  form.append('lessonId', input.lessonId);
  if (input.pageCount !== undefined) {
    form.append('pageCount', String(input.pageCount));
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
    throw new Error('PDF file is required');
  }
  return form;
}

export const pdfApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPdfs: builder.query<
      { success: boolean; pdfs: PdfDto[] },
      { lessonId?: string } | void
    >({
      query: (arg) => {
        const lessonId = arg && typeof arg === 'object' ? arg.lessonId : undefined;
        const params = new URLSearchParams();
        if (lessonId) {
          params.set('lesson', lessonId);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        return `/pdfs${query}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.pdfs.map(({ id }) => ({ type: 'Pdf' as const, id })),
              { type: 'Pdfs', id: 'LIST' },
            ]
          : [{ type: 'Pdfs', id: 'LIST' }],
    }),
    getPdf: builder.query<{ success: boolean; pdf: PdfDto }, string>({
      query: (id) => `/pdfs/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Pdf', id }],
    }),
    createPdf: builder.mutation<{ success: boolean; pdf: PdfDto }, PdfFormInput>({
      query: (input) => ({
        url: '/pdfs',
        method: 'POST',
        body: toFormData(input, true),
      }),
      invalidatesTags: (_result, _error, { lessonId }) => [
        { type: 'Pdfs', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        { type: 'Lesson', id: lessonId },
      ],
    }),
    updatePdf: builder.mutation<
      { success: boolean; pdf: PdfDto },
      {
        id: string;
        body: UpdatePdfBody | PdfFormInput;
        invalidateLessonId?: string | null;
      }
    >({
      query: ({ id, body }) => {
        if ('file' in body && body.file) {
          return {
            url: `/pdfs/${id}`,
            method: 'PATCH',
            body: toFormData(body as PdfFormInput, false),
          };
        }
        const jsonBody: UpdatePdfBody =
          'file' in body
            ? {
                title: body.title,
                description: body.description,
                lessonId: body.lessonId,
                pageCount: body.pageCount,
                duration: body.duration,
              }
            : body;
        return {
          url: `/pdfs/${id}`,
          method: 'PATCH',
          body: jsonBody,
        };
      },
      invalidatesTags: (result, _error, { id, invalidateLessonId }) => [
        { type: 'Pdf', id },
        { type: 'Pdfs', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(result?.pdf.lessonId ? [{ type: 'Lesson' as const, id: result.pdf.lessonId }] : []),
        ...(invalidateLessonId ? [{ type: 'Lesson' as const, id: invalidateLessonId }] : []),
      ],
    }),
    deletePdf: builder.mutation<
      { success: boolean; deleted?: boolean },
      { id: string; lessonId?: string | null }
    >({
      query: ({ id }) => ({
        url: `/pdfs/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { id, lessonId }) => [
        { type: 'Pdf', id },
        { type: 'Pdfs', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(lessonId ? [{ type: 'Lesson' as const, id: lessonId }] : []),
      ],
    }),
    markPdfSeen: builder.mutation<{ success: boolean; pdf: PdfDto }, string>({
      query: (id) => ({
        url: `/pdfs/${id}/seen`,
        method: 'POST',
      }),
      invalidatesTags: (result, _error, id) => [
        { type: 'Pdf', id },
        { type: 'Pdfs', id: 'LIST' },
        { type: 'Lessons', id: 'LIST' },
        ...(result?.pdf.lessonId ? [{ type: 'Lesson' as const, id: result.pdf.lessonId }] : []),
      ],
    }),
  }),
});

export const {
  useListPdfsQuery,
  useGetPdfQuery,
  useCreatePdfMutation,
  useUpdatePdfMutation,
  useDeletePdfMutation,
  useMarkPdfSeenMutation,
} = pdfApi;
