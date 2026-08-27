'use client';

import { useToast } from '@/components/Toaster';
import { getErrorMessage, useCreateTextAreaMutation } from '@/store/api';
import { TextContentForm } from './TextContentForm';
import type { LessonContentFormProps } from './types';

export function AddTextContentForm({ lessonId, onCancel, onSuccess }: LessonContentFormProps) {
  const toast = useToast();
  const [createTextArea, { isLoading }] = useCreateTextAreaMutation();

  return (
    <TextContentForm
      submitLabel="Add text"
      submitting={isLoading}
      onCancel={onCancel}
      onSubmit={async (values) => {
        try {
          await createTextArea({
            title: values.title,
            description: values.description,
            body: values.body,
            duration: values.duration,
            lessonId,
          }).unwrap();
          toast.success('Text content added.');
          onSuccess();
        } catch (err) {
          throw new Error(getErrorMessage(err, 'Could not add text content'));
        }
      }}
    />
  );
}
