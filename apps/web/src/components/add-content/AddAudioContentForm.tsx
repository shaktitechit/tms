'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioStatus } from '@video/shared';
import {
  AudioLibraryPicker,
  LibraryConfirmActions,
} from '@/components/AudioLibraryPicker';
import { StatusBadge } from '@/components/StatusBadge';
import { Field, inputClassName, primaryButtonClassName } from '@/components/portals';
import { useToast } from '@/components/Toaster';
import { formatBytes } from '@/lib/format';
import type { AudioDto } from '@/lib/types';
import {
  apiSlice,
  getErrorMessage,
  useGetAudioStatusQuery,
  useUpdateAudioMutation,
} from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import type { LessonContentFormProps } from './types';

const statusCopy: Record<string, string> = {
  [AudioStatus.UPLOADING]: 'Uploading',
  [AudioStatus.UPLOADED]: 'Uploaded',
  [AudioStatus.QUEUED]: 'Queued',
  [AudioStatus.PROCESSING]: 'Processing',
  [AudioStatus.READY]: 'Ready',
  [AudioStatus.FAILED]: 'Failed',
};

type AddMode = 'upload' | 'library';
type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export function AddAudioContentForm({
  lessonId,
  onCancel,
  onSuccess,
}: LessonContentFormProps) {
  const toast = useToast();
  const dispatch = useAppDispatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<AddMode>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [audioId, setAudioId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLibraryAudio, setSelectedLibraryAudio] = useState<AudioDto | null>(null);
  const [updateAudio, { isLoading: linking }] = useUpdateAudioMutation();
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const shouldPoll = phase === 'processing' && !!audioId;
  const { data: status, error: statusError } = useGetAudioStatusQuery(audioId ?? '', {
    skip: !shouldPoll,
    pollingInterval: shouldPoll ? 2000 : 0,
  });

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!status || phase !== 'processing') {
      return;
    }
    if (status.status === AudioStatus.READY) {
      setPhase('done');
      toast.success('Audio is ready.');
      onSuccess();
    } else if (status.status === AudioStatus.FAILED) {
      setPhase('error');
      const message = status.errorMessage ?? 'Audio processing failed';
      setError(message);
      toast.error(message);
    }
  }, [status, phase, toast, onSuccess]);

  useEffect(() => {
    if (statusError && phase === 'processing') {
      setError(getErrorMessage(statusError, 'Status check failed'));
    }
  }, [statusError, phase]);

  const onFiles = useCallback((list: FileList | null) => {
    const next = list?.[0];
    if (!next) {
      return;
    }
    setFile(next);
    setTitle((current) => current || next.name.replace(/\.[^.]+$/, ''));
    setPhase('idle');
    setError(null);
    setAudioId(null);
    setUploadProgress(0);
  }, []);

  function upload() {
    if (!file) {
      setError('Audio file is required.');
      return;
    }

    const form = new FormData();
    form.append('title', title.trim() || file.name.replace(/\.[^.]+$/, ''));
    form.append('description', description.trim());
    form.append('lessonId', lessonId);
    form.append('fileSize', String(file.size));
    form.append('file', file);

    setPhase('uploading');
    setError(null);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/audios');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onerror = () => {
      setPhase('error');
      setError('Upload failed');
      toast.error('Upload failed');
    };
    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText) as {
          success?: boolean;
          message?: string;
          audio?: { id: string; status: string };
        };
        if (xhr.status >= 400 || !payload.audio) {
          const message = payload.message ?? 'Upload failed';
          setPhase('error');
          setError(message);
          toast.error(message);
          return;
        }
        setUploadProgress(100);
        setAudioId(payload.audio.id);
        setPhase('processing');
        toast.success('Audio uploaded. Processing started.');
        dispatch(
          apiSlice.util.invalidateTags([
            { type: 'Audios', id: 'LIST' },
            { type: 'Lesson', id: lessonId },
          ]),
        );
      } catch {
        setPhase('error');
        setError('Unexpected upload response');
        toast.error('Unexpected upload response');
      }
    };
    xhr.send(form);
  }

  async function linkFromLibrary() {
    if (!selectedLibraryAudio) {
      return;
    }
    setError(null);
    try {
      await updateAudio({
        id: selectedLibraryAudio.id,
        body: { lessonId },
        invalidateLessonId: lessonId,
      }).unwrap();
      toast.success('Audio added from library.');
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add audio from library'));
    }
  }

  const busy = phase === 'uploading' || phase === 'processing';
  const barWidth =
    phase === 'uploading'
      ? uploadProgress
      : status?.status === AudioStatus.READY
        ? 100
        : Math.max(uploadProgress === 100 ? 100 : 0, status?.progress ?? 0);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-full border border-blue-100 bg-slate-50 p-1">
        <button
          type="button"
          disabled={busy || linking}
          onClick={() => setMode('upload')}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            mode === 'upload' ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
          }`}
        >
          Upload new
        </button>
        <button
          type="button"
          disabled={busy || linking}
          onClick={() => setMode('library')}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            mode === 'library' ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
          }`}
        >
          Select from library
        </button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {mode === 'library' ? (
        <div className="space-y-4">
          <AudioLibraryPicker
            lessonId={lessonId}
            selectedId={selectedLibraryAudio?.id}
            onSelect={setSelectedLibraryAudio}
            busy={linking}
          />
          <LibraryConfirmActions
            selected={selectedLibraryAudio}
            busy={linking}
            confirmLabel="Add to lesson"
            onCancel={onCancel}
            onConfirm={() => void linkFromLibrary()}
          />
        </div>
      ) : (
        <>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              onFiles(event.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border border-dashed p-6 text-center transition sm:p-8 ${
              dragOver
                ? 'border-accent bg-blue-50'
                : 'border-blue-200 bg-white hover:border-accent/50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => onFiles(event.target.files)}
            />
            <p className="text-base font-medium text-slate-900">
              Drag and drop audio, or click to choose
            </p>
            <p className="mt-2 text-sm text-slate-500">MP3, WAV, AAC, M4A, and more</p>
          </div>

          {file ? (
            <div className="space-y-4 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
              {previewUrl ? <audio src={previewUrl} controls className="w-full" /> : null}
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
                  <dd className="text-slate-900">{file.type || 'unknown'}</dd>
                </div>
              </dl>
              <Field label="Title">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={inputClassName}
                  disabled={busy}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className={`${inputClassName} min-h-24`}
                  disabled={busy}
                />
              </Field>
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  className="rounded-full border border-blue-100 px-4 py-2 text-sm text-slate-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={upload}
                  disabled={busy}
                  className={`${primaryButtonClassName} sm:w-auto sm:px-8`}
                >
                  {busy ? 'Working…' : 'Upload'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-blue-100 px-4 py-2 text-sm text-slate-600"
              >
                Cancel
              </button>
            </div>
          )}

          {phase !== 'idle' ? (
            <div className="space-y-3 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">
                  {phase === 'uploading' && uploadProgress < 100
                    ? 'Uploading'
                    : phase === 'uploading' || phase === 'processing'
                      ? 'Audio uploaded. Processing…'
                      : phase === 'done'
                        ? 'Audio is ready'
                        : 'Upload issue'}
                </p>
                {status ? <StatusBadge status={status.status} /> : null}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-blue-50">
                <div className="h-full bg-accent transition-all" style={{ width: `${barWidth}%` }} />
              </div>
              <p className="text-sm text-slate-500">
                {phase === 'uploading'
                  ? `${uploadProgress}%`
                  : status
                    ? `${statusCopy[status.status] ?? status.status}${
                        status.status === AudioStatus.PROCESSING ? ` · ${status.progress}%` : ''
                      }`
                    : uploadProgress === 100
                      ? '100%'
                      : null}
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
