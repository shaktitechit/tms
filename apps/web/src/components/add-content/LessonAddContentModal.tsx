'use client';

import { useState } from 'react';
import { LessonModal } from '@/components/LessonFormModal';
import { AddAudioContentForm } from './AddAudioContentForm';
import { AddImageContentForm } from './AddImageContentForm';
import { AddPdfContentForm } from './AddPdfContentForm';
import { AddQuizContentForm } from './AddQuizContentForm';
import { AddTextContentForm } from './AddTextContentForm';
import { AddVideoContentForm } from './AddVideoContentForm';
import { LESSON_CONTENT_TYPES, type LessonContentType } from './types';

export type { LessonContentType } from './types';

export function LessonAddContentModal({
  lessonId,
  moduleId,
  onClose,
  onCreated,
}: {
  lessonId: string;
  moduleId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [contentType, setContentType] = useState<LessonContentType | null>(null);

  function handleSuccess() {
    onCreated();
    onClose();
  }

  const typeLabel = LESSON_CONTENT_TYPES.find((item) => item.id === contentType)?.label;
  const formProps = {
    lessonId,
    moduleId,
    onCancel: onClose,
    onSuccess: handleSuccess,
  };

  return (
    <LessonModal
      title={contentType ? `Add ${typeLabel?.toLowerCase() ?? 'content'}` : 'Add content'}
      onClose={onClose}
      fullScreen
    >
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div>
          <p className="text-sm font-medium text-slate-700">Content type</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LESSON_CONTENT_TYPES.map((item) => {
              const selected = contentType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setContentType(item.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    selected
                      ? 'border-accent bg-blue-50 text-accent'
                      : 'border-blue-100 bg-white text-slate-700 hover:border-blue-200'
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{item.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {contentType ? (
          <div className="border-t border-blue-50 pt-5">
            {contentType === 'text' ? <AddTextContentForm {...formProps} /> : null}
            {contentType === 'video' ? <AddVideoContentForm {...formProps} /> : null}
            {contentType === 'audio' ? <AddAudioContentForm {...formProps} /> : null}
            {contentType === 'image' ? <AddImageContentForm {...formProps} /> : null}
            {contentType === 'quiz' ? <AddQuizContentForm {...formProps} /> : null}
            {contentType === 'pdf' ? <AddPdfContentForm {...formProps} /> : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Choose a content type to continue.</p>
        )}
      </div>
    </LessonModal>
  );
}
