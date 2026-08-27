'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioStatus } from '@video/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { Field, inputClassName, primaryButtonClassName } from '@/components/portals/shared/AuthCard';
import { useToast } from '@/components/Toaster';
import { formatBytes } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { audioSlugOf, canUpload } from '@/lib/roles';
import { apiSlice, getErrorMessage, useGetAudioStatusQuery } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';

const statusCopy: Record<string, string> = {
  [AudioStatus.UPLOADING]: 'Uploading',
  [AudioStatus.UPLOADED]: 'Uploaded',
  [AudioStatus.QUEUED]: 'Queued',
  [AudioStatus.PROCESSING]: 'Processing',
  [AudioStatus.READY]: 'Ready',
  [AudioStatus.FAILED]: 'Failed',
};

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export function AudioUploadForm({ detailHref }: { detailHref: (slug: string) => string }) {
  const { user } = useAuth();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [audioId, setAudioId] = useState<string | null>(null);
  const [audioSlug, setAudioSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      dispatch(apiSlice.util.invalidateTags([{ type: 'Audios', id: 'LIST' }]));
    } else if (status.status === AudioStatus.FAILED) {
      setPhase('error');
      const message = status.errorMessage ?? 'Audio processing failed';
      setError(message);
      toast.error(message);
    }
  }, [status, phase, dispatch, toast]);

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
    setAudioSlug(null);
    setUploadProgress(0);
  }, []);

  function upload() {
    if (!file || !user) {
      return;
    }

    const form = new FormData();
    form.append('title', title.trim() || file.name.replace(/\.[^.]+$/, ''));
    form.append('description', description.trim());
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
          audio?: { id: string; slug?: string; status: string };
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
        setAudioSlug(audioSlugOf(payload.audio));
        setPhase('processing');
        toast.success('Audio uploaded. Processing started.');
        dispatch(apiSlice.util.invalidateTags([{ type: 'Audios', id: 'LIST' }]));
      } catch {
        setPhase('error');
        setError('Unexpected upload response');
        toast.error('Unexpected upload response');
      }
    };
    xhr.send(form);
  }

  const busy = phase === 'uploading' || phase === 'processing';

  if (user && !canUpload(user)) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-blue-100 bg-white p-5 sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Upload not available</h1>
        <p className="text-slate-500">
          Member accounts can browse the tenant library. Only tenant admins can upload audio.
        </p>
      </div>
    );
  }

  const barWidth =
    phase === 'uploading'
      ? uploadProgress
      : status?.status === AudioStatus.READY
        ? 100
        : Math.max(uploadProgress === 100 ? 100 : 0, status?.progress ?? 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Library</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Upload audio
        </h1>
        <p className="mt-1 text-slate-500">
          MP3, WAV, AAC, or M4A. Processing happens in the worker, not the API.
        </p>
      </div>

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
        className={`cursor-pointer rounded-3xl border border-dashed p-6 text-center transition sm:p-10 ${
          dragOver ? 'border-accent bg-blue-50' : 'border-blue-200 bg-white hover:border-accent/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(event) => onFiles(event.target.files)}
        />
        <p className="text-base font-medium text-slate-900 sm:text-lg">
          Drag and drop audio, or click to choose
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Original files are stored in MinIO and never in MongoDB.
        </p>
      </div>

      {file ? (
        <div className="space-y-5 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
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
          <button
            type="button"
            onClick={upload}
            disabled={busy}
            className={`${primaryButtonClassName} sm:w-auto sm:px-8`}
          >
            {busy ? 'Working…' : 'Upload'}
          </button>
        </div>
      ) : null}

      {phase !== 'idle' ? (
        <div className="space-y-4 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
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
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {phase === 'done' && audioSlug ? (
            <Link
              href={detailHref(audioSlug)}
              className="inline-flex justify-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              Open audio
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
