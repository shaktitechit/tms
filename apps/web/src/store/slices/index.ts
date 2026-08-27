export { authApi } from './auth.api';
export {
  useMeQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
} from './auth.api';

export { tenantApi } from './tenant.api';
export { useGetTenantMeQuery, useUpdateTenantMeMutation } from './tenant.api';

export { userApi } from './user.api';
export {
  useListUsersQuery,
  useGetUserQuery,
  useGetUserProgressQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} from './user.api';

export { memberModuleApi } from './member-module.api';
export {
  useListMemberModulesQuery,
  useGetMemberModuleQuery,
  useCreateMemberModuleMutation,
  useReplaceMemberModulesMutation,
  useDeleteMemberModuleMutation,
} from './member-module.api';

export { moduleApi } from './module.api';
export {
  useListModulesQuery,
  useGetModuleQuery,
  useCreateModuleMutation,
  useUpdateModuleMutation,
  useDeleteModuleMutation,
} from './module.api';

export { departmentApi } from './department.api';
export {
  useListDepartmentsQuery,
  useGetDepartmentQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
} from './department.api';

export { lessonApi } from './lesson.api';
export {
  useListLessonsQuery,
  useGetLessonQuery,
  useCreateLessonMutation,
  useUpdateLessonMutation,
  useDeleteLessonMutation,
  useReorderLessonContentMutation,
  useReorderLessonsMutation,
} from './lesson.api';

export { textAreaApi } from './text-area.api';
export {
  useListTextAreasQuery,
  useGetTextAreaQuery,
  useCreateTextAreaMutation,
  useUpdateTextAreaMutation,
  useDeleteTextAreaMutation,
  useMarkTextAreaSeenMutation,
} from './text-area.api';

export { audioApi } from './audio.api';
export {
  useListAudiosQuery,
  useGetAudioQuery,
  useGetAudioStatusQuery,
  useLazyGetAudioStatusQuery,
  useCreateAudioMutation,
  useUpdateAudioMutation,
  useDeleteAudioMutation,
  useMarkAudioSeenMutation,
} from './audio.api';

export { imageApi } from './image.api';
export {
  useListImagesQuery,
  useGetImageQuery,
  useCreateImageMutation,
  useUpdateImageMutation,
  useDeleteImageMutation,
  useMarkImageSeenMutation,
} from './image.api';

export { quizApi } from './quiz.api';
export {
  useListQuizzesQuery,
  useGetQuizQuery,
  useCreateQuizMutation,
  useUpdateQuizMutation,
  useDeleteQuizMutation,
  useMarkQuizSeenMutation,
} from './quiz.api';

export { pdfApi } from './pdf.api';
export {
  useListPdfsQuery,
  useGetPdfQuery,
  useCreatePdfMutation,
  useUpdatePdfMutation,
  useDeletePdfMutation,
  useMarkPdfSeenMutation,
} from './pdf.api';

export { discussionApi } from './discussion.api';
export {
  useListDiscussionsQuery,
  useGetDiscussionQuery,
  useCreateDiscussionMutation,
  useUpdateDiscussionMutation,
  useDeleteDiscussionMutation,
} from './discussion.api';

export { videoApi } from './video.api';
export {
  useListVideosQuery,
  useGetVideoQuery,
  useGetVideoStatusQuery,
  useLazyGetVideoStatusQuery,
  useUpdateVideoMutation,
  useDeleteVideoMutation,
  useUploadVideoMutation,
  useMarkVideoSeenMutation,
} from './video.api';
