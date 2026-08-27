import type {
  AudioQuality,
  AudioStatus,
  ContentSeenStatus,
  MemberAccess,
  VideoQuality,
  VideoSeenStatus,
  VideoStatus,
  VideoVisibility,
} from '@video/shared';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username: string;
  role: string;
  access?: MemberAccess | null;
  tenantId: string;
  tenantSlug: string;
}

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  logoUrl: string | null;
}

export interface TenantUserDto {
  id: string;
  email: string;
  name: string;
  username: string;
  role: string;
  access: MemberAccess | null;
  tenantId: string;
  departmentIds: string[];
  departments: Array<{ id: string; name: string; slug: string | null }>;
  moduleIds: string[];
  modules: Array<{ id: string; name: string; slug: string | null; departmentId: string | null }>;
  createdAt: string;
  updatedAt: string;
}

export interface MemberModuleDto {
  id: string;
  userId: string;
  moduleId: string | null;
  moduleName: string | null;
  moduleSlug: string | null;
  departmentId: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  authorName: string;
  authorEmail: string;
  tenantId: string;
  departmentId: string | null;
  departmentName: string | null;
  departmentSlug: string | null;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl: string | null;
  lessonCount?: number;
  lessons?: LessonDto[];
}

export interface LessonContentCounts {
  textAreas: number;
  videos: number;
  audios: number;
  images: number;
  quizzes: number;
  pdfs: number;
}

export type LessonContentKind = 'text' | 'video' | 'audio' | 'image' | 'quiz' | 'pdf';

export type LessonContentOrderItem = {
  kind: LessonContentKind;
  id: string;
};

export interface LessonDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  authorName: string;
  authorEmail: string;
  tenantId: string;
  moduleId: string | null;
  moduleName: string | null;
  moduleSlug: string | null;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl: string | null;
  duration?: number | null;
  completedPercent?: number;
  serial?: number | null;
  seenStatus?: ContentSeenStatus;
  contentOrder?: LessonContentOrderItem[];
  textAreas?: TextAreaDto[];
  videos?: VideoDto[];
  audios?: AudioDto[];
  images?: ImageDto[];
  quizzes?: QuizDto[];
  pdfs?: PdfDto[];
  contentCounts?: LessonContentCounts;
}

export interface DepartmentDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  tenantId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl: string | null;
  moduleCount?: number;
  modules?: ModuleDto[];
}

export interface VideoDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  originalFilename: string;
  status: VideoStatus;
  processingProgress: number;
  duration: number | null;
  fileSize: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  availableQualities: VideoQuality[];
  visibility: VideoVisibility;
  createdBy: string;
  tenantId: string;
  moduleId: string | null;
  moduleName: string | null;
  moduleSlug: string | null;
  departmentId: string | null;
  departmentName: string | null;
  departmentSlug: string | null;
  lessonId: string | null;
  lessonName: string | null;
  lessonSlug: string | null;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
  thumbnailUrl: string | null;
  playbackUrl: string | null;
  seenStatus: VideoSeenStatus;
}

export interface VideoStatusDto {
  id: string;
  slug?: string;
  status: VideoStatus;
  progress: number;
  errorMessage: string | null;
}

export interface AudioStatusDto {
  id: string;
  slug?: string;
  status: AudioStatus;
  progress: number;
  errorMessage: string | null;
}

export type UpdateVideoBody = Partial<
  Pick<VideoDto, 'title' | 'description' | 'visibility' | 'moduleId' | 'lessonId'>
>;

export interface DiscussionDto {
  id: string;
  body: string;
  videoId: string | null;
  lessonId: string | null;
  tenantId: string;
  parentId: string | null;
  createdBy: string;
  authorName: string | null;
  authorUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateDiscussionBody = {
  body: string;
  parentId?: string;
} & ({ videoId: string; lessonId?: never } | { lessonId: string; videoId?: never });

type LessonScopedFields = {
  lessonId: string | null;
  lessonName: string | null;
  lessonSlug: string | null;
  moduleId?: string | null;
  moduleName?: string | null;
  tenantId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  seenStatus: ContentSeenStatus;
};

export interface TextAreaDto extends LessonScopedFields {
  id: string;
  title: string;
  slug: string;
  description: string;
  body: string;
  duration: number | null;
}

export type CreateTextAreaBody = {
  title: string;
  description?: string;
  body: string;
  duration?: number | null;
  lessonId: string;
};

export type UpdateTextAreaBody = Partial<
  Pick<CreateTextAreaBody, 'title' | 'description' | 'body' | 'duration' | 'lessonId'>
>;

export interface AudioDto extends LessonScopedFields {
  id: string;
  title: string;
  slug: string;
  description: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  duration: number | null;
  status: AudioStatus;
  processingProgress: number;
  availableQualities: AudioQuality[];
  errorMessage: string | null;
  fileUrl: string;
  streamUrl: string;
  playbackUrl: string | null;
}

export type AudioFormInput = {
  title: string;
  description?: string;
  lessonId?: string;
  file?: File | null;
};

export type UpdateAudioBody = {
  title?: string;
  description?: string;
  lessonId?: string | null;
};

export interface ImageDto extends LessonScopedFields {
  id: string;
  title: string;
  slug: string;
  description: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileUrl: string;
}

export type ImageFormInput = {
  title: string;
  description?: string;
  lessonId: string;
  width?: number;
  height?: number;
  duration?: number | null;
  file?: File | null;
};

export type UpdateImageBody = {
  title?: string;
  description?: string;
  lessonId?: string;
  width?: number;
  height?: number;
  duration?: number | null;
};

export interface QuizQuestionDto {
  prompt: string;
  options: string[];
  correctIndex: number;
  /** Time limit in seconds. */
  duration: number;
}

export type QuizAnswerOutcome = 'correct' | 'wrong' | 'timedOut';

export type QuizAnswerResultDto = {
  selectedIndex: number | null;
  outcome: QuizAnswerOutcome;
};

export type QuizResultDto = {
  score: number;
  totalQuestions: number;
  answers: QuizAnswerResultDto[];
  attemptCount: number;
  completedAt: string | null;
};

export interface QuizDto extends LessonScopedFields {
  id: string;
  title: string;
  slug: string;
  description: string;
  questions: QuizQuestionDto[];
  result: QuizResultDto | null;
  duration?: number | null;
}

export type CreateQuizBody = {
  title: string;
  description?: string;
  questions?: QuizQuestionDto[];
  lessonId: string;
};

export type UpdateQuizBody = Partial<
  Pick<CreateQuizBody, 'title' | 'description' | 'questions' | 'lessonId'>
>;

export type MarkQuizSeenBody = {
  answers: Array<{ selectedIndex: number | null }>;
};
export interface PdfDto extends LessonScopedFields {
  id: string;
  title: string;
  slug: string;
  description: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  pageCount: number | null;
  duration: number | null;
  fileUrl: string;
}

export type PdfFormInput = {
  title: string;
  description?: string;
  lessonId: string;
  pageCount?: number;
  duration?: number | null;
  file?: File | null;
};

export type UpdatePdfBody = {
  title?: string;
  description?: string;
  lessonId?: string;
  pageCount?: number;
  duration?: number | null;
};

export interface CurriculumDto {
  success: boolean;
  departments: DepartmentDto[];
  modules: ModuleDto[];
  videos: VideoDto[];
  audios: AudioDto[];
  images: ImageDto[];
  pdfs: PdfDto[];
  textAreas: TextAreaDto[];
  quizzes: QuizDto[];
}

export interface MemberProgressDto extends CurriculumDto {
  user: TenantUserDto;
}
