'use client';

import { useEffect, useMemo, useState } from 'react';
import { Field, inputClassName } from '@/components/portals';
import { useToast } from '@/components/Toaster';
import { formatBytes } from '@/lib/format';
import { getErrorMessage, useCreatePdfMutation } from '@/store/api';
import { ContentFormActions } from './ContentFormActions';
import { fileInputClassName, type LessonContentFormProps } from './types';

export function AddPdfContentForm({ lessonId, onCancel, onSuccess }: LessonContentFormProps) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createPdf, { isLoading }] = useCreatePdfMutation();
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError('PDF file is required.');
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
      await createPdf({
        title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
        description: description.trim(),
        lessonId,
        duration,
        file,
      }).unwrap();
      toast.success('PDF added.');
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add PDF'));
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <Field label="Title">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Defaults to filename"
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
      <Field label="PDF file">
        <input
          required
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => {
            const next = event.target.files?.[0] ?? null;
            setFile(next);
            if (next) {
              setTitle((current) => current || next.name.replace(/\.[^.]+$/, ''));
            }
          }}
          className={fileInputClassName}
        />
      </Field>
      {file && previewUrl ? (
        <div className="space-y-3 rounded-2xl border border-blue-100 bg-white p-4">
          <iframe
            title={title || file.name}
            src={previewUrl}
            className="h-64 w-full rounded-xl border border-blue-50 bg-slate-50"
          />
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-slate-500">Filename</dt>
              <dd className="truncate text-slate-900">{file.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Size</dt>
              <dd className="text-slate-900">{formatBytes(file.size)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Type</dt>
              <dd className="text-slate-900">{file.type || 'application/pdf'}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      <ContentFormActions submitLabel="Add PDF" submitting={isLoading} onCancel={onCancel} />
    </form>
  );
}
