import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Shared RTK Query API. Module endpoints are injected from `./slices/*`.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    credentials: 'include',
    prepareHeaders: (headers, { endpoint }) => {
      if (
        endpoint === 'uploadVideo' ||
        endpoint === 'createModule' ||
        endpoint === 'updateModule' ||
        endpoint === 'updateTenantMe' ||
        endpoint === 'createDepartment' ||
        endpoint === 'updateDepartment' ||
        endpoint === 'createLesson' ||
        endpoint === 'updateLesson' ||
        endpoint === 'createAudio' ||
        endpoint === 'updateAudio' ||
        endpoint === 'createImage' ||
        endpoint === 'updateImage' ||
        endpoint === 'createPdf' ||
        endpoint === 'updatePdf'
      ) {
        headers.delete('Content-Type');
      }
      return headers;
    },
  }),
  tagTypes: [
    'Me',
    'Tenant',
    'Users',
    'User',
    'MemberModules',
    'MemberModule',
    'Departments',
    'Department',
    'Modules',
    'Module',
    'Lessons',
    'Lesson',
    'TextAreas',
    'TextArea',
    'Audios',
    'Audio',
    'Images',
    'Image',
    'Quizzes',
    'Quiz',
    'Pdfs',
    'Pdf',
    'Videos',
    'Video',
    'Discussions',
    'Discussion',
    'LiveSessions',
    'LiveSession',
    'LiveChatHistory',
  ],
  endpoints: () => ({}),
});
