export type LessonContentType = 'text' | 'video' | 'audio' | 'image' | 'quiz' | 'pdf';

export const LESSON_CONTENT_TYPES: Array<{
  id: LessonContentType;
  label: string;
  hint: string;
}> = [
  { id: 'text', label: 'Text', hint: 'Written section' },
  { id: 'video', label: 'Video', hint: 'Upload & process' },
  { id: 'audio', label: 'Audio', hint: 'Audio file' },
  { id: 'image', label: 'Image', hint: 'Image file' },
  { id: 'quiz', label: 'Quiz', hint: 'Multiple choice' },
  { id: 'pdf', label: 'PDF', hint: 'Document file' },
];

export type LessonContentFormProps = {
  lessonId: string;
  moduleId?: string | null;
  onCancel: () => void;
  onSuccess: () => void;
};

export const fileInputClassName =
  'block w-full text-sm text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:text-accent';
