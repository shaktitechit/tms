'use client';

import { useState } from 'react';
import { Field, inputClassName } from '@/components/portals';
import { RichTextEditor, isRichTextEmpty } from '@/components/RichTextEditor';
import { ContentFormActions } from './ContentFormActions';

export type TextContentFormValues = {
  title: string;
  description: string;
  body: string;
  /** Duration in seconds. */
  duration: number | null;
};

export function TextContentForm({
  initial,
  submitLabel,
  submitting,
  onCancel,
  onSubmit,
}: {
  initial?: Partial<TextContentFormValues>;
  submitLabel: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: TextContentFormValues) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [durationMinutes, setDurationMinutes] = useState(() => {
    const seconds = initial?.duration;
    if (typeof seconds === 'number' && seconds > 0) {
      return String(Math.round(seconds / 60));
    }
    return '';
  });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (isRichTextEmpty(body)) {
      setError('Body is required');
      return;
    }

    let duration: number | null = null;
    if (durationMinutes.trim()) {
      const minutes = Number(durationMinutes);
      if (!Number.isFinite(minutes) || minutes < 0) {
        setError('Duration must be a non-negative number of minutes');
        return;
      }
      duration = Math.round(minutes * 60);
    }

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        body,
        duration,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save text content');
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <Field label="Title">
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Required"
          className={inputClassName}
        />
      </Field>
      <Field label="Description">
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional"
          className={inputClassName}
        />
      </Field>
      <Field label="Duration (minutes)">
        <input
          type="number"
          min={0}
          step={1}
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(event.target.value)}
          placeholder="e.g. 5"
          className={inputClassName}
        />
      </Field>
      <Field label="Body">
        <RichTextEditor value={body} onChange={setBody} />
      </Field>
      <ContentFormActions
        submitLabel={submitLabel}
        submitting={submitting}
        onCancel={onCancel}
      />
    </form>
  );
}
