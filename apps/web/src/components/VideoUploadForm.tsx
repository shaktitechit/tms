'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseYoutubeVideoId, VideoStatus, VideoVisibility, youtubeEmbedUrl } from '@video/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';
import { Field, inputClassName, primaryButtonClassName } from '@/components/portals/shared/AuthCard';
import { useToast } from '@/components/Toaster';
import { formatBytes } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { canUpload, videoSlugOf, watchPath } from '@/lib/roles';
import {
  apiSlice,
  getErrorMessage,
  managedVideosPath,
  useGetVideoStatusQuery,
  useImportYoutubeVideoMutation,
  useListModulesQuery,
} from '@/store/api';
import { useAppDispatch } from '@/store/hooks';

const statusCopy: Record<string, string> = {
  [VideoStatus.UPLOADING]: 'Uploading',
  [VideoStatus.UPLOADED]: 'Uploaded',
  [VideoStatus.QUEUED]: 'Queued',
  [VideoStatus.PROCESSING]: 'Processing',
  [VideoStatus.READY]: 'Ready',
  [VideoStatus.FAILED]: 'Failed',
};

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';
type VideoSourceMode = 'file' | 'youtube';

export function VideoUploadForm({ detailHref }: { detailHref: (id: string) => string }) {
  const { user } = useAuth();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const { data: modulesData, isLoading: modulesLoading } = useListModulesQuery();
  const [importYoutube, { isLoading: importingYoutube }] = useImportYoutubeVideoMutation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<VideoSourceMode>('file');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<VideoVisibility>(VideoVisibility.PUBLIC);
  const [moduleId, setModuleId] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoSlug, setVideoSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const shouldPoll = phase === 'processing' && !!videoId;
  const { data: status, error: statusError } = useGetVideoStatusQuery(
    { id: videoId ?? '', role: user?.role },
    {
      skip: !shouldPoll || !user,
      pollingInterval: shouldPoll ? 2000 : 0,
    },
  );

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
    if (status.status === VideoStatus.READY) {
      setPhase('done');
      toast.success('Video is ready.');
      dispatch(apiSlice.util.invalidateTags([{ type: 'Videos', id: 'LIST' }]));
    } else if (status.status === VideoStatus.FAILED) {
      setPhase('error');
      const message = status.errorMessage ?? 'Video processing failed';
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
    setVideoId(null);
    setVideoSlug(null);
    setUploadProgress(0);
  }, []);

  function upload() {
    if (!file || !user) {
      return;
    }
    const form = new FormData();
    form.append('title', title);
    form.append('description', description);
    form.append('visibility', visibility);
    if (moduleId) {
      form.append('moduleId', moduleId);
    }
    form.append('video', file);

    setPhase('uploading');
    setError(null);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${managedVideosPath(user.role)}`);
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
          video?: { id: string; slug?: string; status: string };
        };
        if (xhr.status >= 400 || !payload.video) {
          const message = payload.message ?? 'Upload failed';
          setPhase('error');
          setError(message);
          toast.error(message);
          return;
        }
        setUploadProgress(100);
        setVideoId(payload.video.id);
        setVideoSlug(videoSlugOf(payload.video));
        setPhase('processing');
        toast.success('Video uploaded. Processing started.');
        dispatch(apiSlice.util.invalidateTags([{ type: 'Videos', id: 'LIST' }]));
      } catch {
        setPhase('error');
        setError('Unexpected upload response');
        toast.error('Unexpected upload response');
      }
    };
    xhr.send(form);
  }

  async function importFromYoutube() {
    if (!user) {
      return;
    }
    const videoIdFromUrl = parseYoutubeVideoId(youtubeUrl);
    if (!videoIdFromUrl) {
      const message = 'Enter a valid YouTube watch, share, Shorts, or embed link';
      setError(message);
      toast.error(message);
      return;
    }

    setPhase('uploading');
    setError(null);
    try {
      const result = await importYoutube({
        role: user.role,
        body: {
          youtubeUrl: youtubeUrl.trim(),
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          visibility,
          ...(moduleId ? { moduleId } : {}),
        },
      }).unwrap();
      setVideoId(result.video.id);
      setVideoSlug(videoSlugOf(result.video));
      setPhase('processing');
      toast.success('YouTube video queued. Processing started.');
      dispatch(apiSlice.util.invalidateTags([{ type: 'Videos', id: 'LIST' }]));
    } catch (err) {
      const message = getErrorMessage(err, 'Could not add YouTube video');
      setPhase('error');
      setError(message);
      toast.error(message);
    }
  }

  function switchSource(next: VideoSourceMode) {
    setSourceMode(next);
    setPhase('idle');
    setError(null);
    setVideoId(null);
    setVideoSlug(null);
    setUploadProgress(0);
  }

  const modules = modulesData?.modules ?? [];
  const youtubeId = parseYoutubeVideoId(youtubeUrl);
  const youtubeBusy = importingYoutube || phase === 'uploading' || phase === 'processing';

  if (user && !canUpload(user)) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-blue-100 bg-white p-5 sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Upload not available</h1>
        <p className="text-slate-500">
          Member accounts can browse and watch the tenant library. Only tenant admins can upload
          videos.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Library</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Upload video</h1>
        <p className="mt-1 text-slate-500">
          Upload a file, or add a YouTube link. Processing happens in the worker, not the API.
        </p>
      </div>

      <div className="mx-auto flex max-w-3xl gap-2 rounded-full border border-blue-100 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => switchSource('file')}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            sourceMode === 'file' ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
          }`}
        >
          Upload file
        </button>
        <button
          type="button"
          onClick={() => switchSource('youtube')}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            sourceMode === 'youtube' ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
          }`}
        >
          YouTube link
        </button>
      </div>

      {sourceMode === 'file' ? (
        <>
          <UploadDropzone
            dragOver={dragOver}
            inputRef={inputRef}
            onDragOver={() => setDragOver(true)}
            onDragLeave={() => setDragOver(false)}
            onFiles={onFiles}
          />

          {file ? (
            <UploadDetailsCard
              file={file}
              previewUrl={previewUrl}
              title={title}
              description={description}
              moduleId={moduleId}
              visibility={visibility}
              modules={modules}
              modulesLoading={modulesLoading}
              busy={phase === 'uploading' || phase === 'processing'}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onModuleChange={setModuleId}
              onVisibilityChange={(value) => setVisibility(value as VideoVisibility)}
              onUpload={upload}
            />
          ) : null}
        </>
      ) : (
        <YoutubeImportCard
          youtubeUrl={youtubeUrl}
          youtubeId={youtubeId}
          title={title}
          description={description}
          moduleId={moduleId}
          visibility={visibility}
          modules={modules}
          modulesLoading={modulesLoading}
          busy={youtubeBusy}
          onUrlChange={(value) => {
            setYoutubeUrl(value);
            setPhase('idle');
            setError(null);
          }}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onModuleChange={setModuleId}
          onVisibilityChange={(value) => setVisibility(value as VideoVisibility)}
          onImport={() => void importFromYoutube()}
        />
      )}

      {phase !== 'idle' ? (
        <UploadProgressCard
          phase={phase}
          uploadProgress={uploadProgress}
          status={status}
          error={error}
          watchHref={phase === 'done' && videoSlug ? watchPath(user, videoSlug) : null}
          detailsHref={phase === 'done' && videoSlug ? detailHref(videoSlug) : null}
        />
      ) : null}
    </div>
  );
}

function UploadDropzone({
  dragOver,
  inputRef,
  onDragOver,
  onDragLeave,
  onFiles,
}: {
  dragOver: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: () => void;
  onDragLeave: () => void;
  onFiles: (list: FileList | null) => void;
}) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDragLeave();
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
        accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv"
        className="hidden"
        onChange={(event) => onFiles(event.target.files)}
      />
      <p className="text-base font-medium text-slate-900 sm:text-lg">Drag and drop a video, or click to choose</p>
      <p className="mt-2 text-sm text-slate-500">Original files are stored in MinIO and never in MongoDB.</p>
    </div>
  );
}

function UploadDetailsCard({
  file,
  previewUrl,
  title,
  description,
  moduleId,
  visibility,
  modules,
  modulesLoading,
  busy,
  onTitleChange,
  onDescriptionChange,
  onModuleChange,
  onVisibilityChange,
  onUpload,
}: {
  file: File;
  previewUrl: string | null;
  title: string;
  description: string;
  moduleId: string;
  visibility: string;
  modules: { id: string; name: string }[];
  modulesLoading: boolean;
  busy: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onModuleChange: (value: string) => void;
  onVisibilityChange: (value: string) => void;
  onUpload: () => void;
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
      {previewUrl ? <video src={previewUrl} controls className="w-full rounded-xl bg-black" /> : null}
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
          onChange={(event) => onTitleChange(event.target.value)}
          className={inputClassName}
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          className={`${inputClassName} min-h-24`}
        />
      </Field>
      <Field label="Module">
        <select
          value={moduleId}
          onChange={(event) => onModuleChange(event.target.value)}
          disabled={modulesLoading}
          className={inputClassName}
        >
          <option value="">No module</option>
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.name}
            </option>
          ))}
        </select>
      </Field>
      {modules.length === 0 && !modulesLoading ? (
        <p className="text-sm text-slate-500">No modules yet. Create modules first to organise uploads.</p>
      ) : null}
      <Field label="Visibility">
        <select
          value={visibility}
          onChange={(event) => onVisibilityChange(event.target.value)}
          className={inputClassName}
        >
          <option value="PUBLIC">Public</option>
          <option value="UNLISTED">Unlisted</option>
          <option value="PRIVATE">Private</option>
        </select>
      </Field>
      <button type="button" onClick={onUpload} disabled={busy} className={`${primaryButtonClassName} sm:w-auto sm:px-8`}>
        Upload
      </button>
    </div>
  );
}

function YoutubeImportCard({
  youtubeUrl,
  youtubeId,
  title,
  description,
  moduleId,
  visibility,
  modules,
  modulesLoading,
  busy,
  onUrlChange,
  onTitleChange,
  onDescriptionChange,
  onModuleChange,
  onVisibilityChange,
  onImport,
}: {
  youtubeUrl: string;
  youtubeId: string | null;
  title: string;
  description: string;
  moduleId: string;
  visibility: string;
  modules: { id: string; name: string }[];
  modulesLoading: boolean;
  busy: boolean;
  onUrlChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onModuleChange: (value: string) => void;
  onVisibilityChange: (value: string) => void;
  onImport: () => void;
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
      <Field label="YouTube link">
        <input
          value={youtubeUrl}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className={inputClassName}
          disabled={busy}
        />
      </Field>
      {youtubeId ? <YouTubeEmbed src={youtubeEmbedUrl(youtubeId)} /> : null}
      <Field label="Title">
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Leave blank to use the YouTube title"
          className={inputClassName}
          disabled={busy}
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          className={`${inputClassName} min-h-24`}
          disabled={busy}
        />
      </Field>
      <Field label="Module">
        <select
          value={moduleId}
          onChange={(event) => onModuleChange(event.target.value)}
          disabled={modulesLoading || busy}
          className={inputClassName}
        >
          <option value="">No module</option>
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.name}
            </option>
          ))}
        </select>
      </Field>
      {modules.length === 0 && !modulesLoading ? (
        <p className="text-sm text-slate-500">No modules yet. Create modules first to organise uploads.</p>
      ) : null}
      <Field label="Visibility">
        <select
          value={visibility}
          onChange={(event) => onVisibilityChange(event.target.value)}
          className={inputClassName}
          disabled={busy}
        >
          <option value="PUBLIC">Public</option>
          <option value="UNLISTED">Unlisted</option>
          <option value="PRIVATE">Private</option>
        </select>
      </Field>
      <button
        type="button"
        onClick={onImport}
        disabled={busy || !youtubeId}
        className={`${primaryButtonClassName} sm:w-auto sm:px-8`}
      >
        {busy ? 'Adding…' : 'Add YouTube video'}
      </button>
    </div>
  );
}

function UploadProgressCard({
  phase,
  uploadProgress,
  status,
  error,
  watchHref,
  detailsHref,
}: {
  phase: UploadPhase;
  uploadProgress: number;
  status?: { status: string; progress?: number } | null;
  error: string | null;
  watchHref: string | null;
  detailsHref: string | null;
}) {
  const barWidth =
    phase === 'uploading'
      ? uploadProgress
      : status?.status === VideoStatus.READY
        ? 100
        : Math.max(uploadProgress === 100 ? 100 : 0, status?.progress ?? 0);

  return (
    <div className="space-y-4 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-slate-900">
          {phase === 'uploading' && uploadProgress < 100
            ? 'Uploading'
            : phase === 'uploading' || phase === 'processing'
              ? 'Video uploaded. Processing video...'
              : phase === 'done'
                ? 'Video is ready'
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
                status.status === VideoStatus.PROCESSING ? ` · ${status.progress}%` : ''
              }`
            : null}
      </p>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {watchHref && detailsHref ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <Link href={watchHref} className="inline-flex justify-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
            Watch Video
          </Link>
          <Link
            href={detailsHref}
            className="inline-flex justify-center rounded-full border border-blue-100 px-4 py-2 text-sm text-slate-700"
          >
            Open details
          </Link>
        </div>
      ) : null}
    </div>
  );
}
