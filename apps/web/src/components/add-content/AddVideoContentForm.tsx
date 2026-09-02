'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseYoutubeVideoId, VideoStatus, VideoVisibility, youtubeEmbedUrl } from '@video/shared';
import {
  VideoLibraryConfirmActions,
  VideoLibraryPicker,
} from '@/components/VideoLibraryPicker';
import { StatusBadge } from '@/components/StatusBadge';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';
import { Field, inputClassName, primaryButtonClassName } from '@/components/portals';
import { useToast } from '@/components/Toaster';
import { formatBytes } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { isTenantAdmin } from '@/lib/roles';
import type { VideoDto } from '@/lib/types';
import {
  managedVideosPath,
  apiSlice,
  getErrorMessage,
  useGetVideoStatusQuery,
  useImportYoutubeVideoMutation,
  useUpdateVideoMutation,
} from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import type { LessonContentFormProps } from './types';

const statusCopy: Record<string, string> = {
  [VideoStatus.UPLOADING]: 'Uploading',
  [VideoStatus.UPLOADED]: 'Uploaded',
  [VideoStatus.QUEUED]: 'Queued',
  [VideoStatus.PROCESSING]: 'Processing',
  [VideoStatus.READY]: 'Ready',
  [VideoStatus.FAILED]: 'Failed',
};

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';
type AddMode = 'upload' | 'youtube' | 'library';

export function AddVideoContentForm({
  lessonId,
  moduleId,
  onCancel,
  onSuccess,
}: LessonContentFormProps) {
  const { user } = useAuth();
  const canAddFromLibrary = isTenantAdmin(user);
  const toast = useToast();
  const dispatch = useAppDispatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<AddMode>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<VideoVisibility>(VideoVisibility.PUBLIC);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLibraryVideo, setSelectedLibraryVideo] = useState<VideoDto | null>(null);
  const [updateVideo, { isLoading: linking }] = useUpdateVideoMutation();
  const [importYoutube, { isLoading: importingYoutube }] = useImportYoutubeVideoMutation();
  const [youtubeUrl, setYoutubeUrl] = useState('');
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
      dispatch(
        apiSlice.util.invalidateTags([
          { type: 'Videos', id: 'LIST' },
          { type: 'Lesson', id: lessonId },
        ]),
      );
      onSuccess();
    } else if (status.status === VideoStatus.FAILED) {
      setPhase('error');
      const message = status.errorMessage ?? 'Video processing failed';
      setError(message);
      toast.error(message);
    }
  }, [status, phase, dispatch, toast, lessonId, onSuccess]);

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
    setUploadProgress(0);
  }, []);

  function upload() {
    if (!file || !user) {
      return;
    }
    const form = new FormData();
    form.append('title', title.trim() || file.name.replace(/\.[^.]+$/, ''));
    form.append('description', description.trim());
    form.append('visibility', visibility);
    form.append('lessonId', lessonId);
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
          video?: { id: string; status: string };
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
        setPhase('processing');
        toast.success('Video uploaded. Processing started.');
        dispatch(
          apiSlice.util.invalidateTags([
            { type: 'Videos', id: 'LIST' },
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
    if (!user || !selectedLibraryVideo) {
      return;
    }
    setError(null);
    try {
      await updateVideo({
        id: selectedLibraryVideo.id,
        role: user.role,
        body: {
          lessonId,
          ...(moduleId ? { moduleId } : {}),
        },
        invalidateLessonId: lessonId,
      }).unwrap();
      toast.success('Video added from library.');
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add video from library'));
    }
  }

  async function importFromYoutube() {
    if (!user) {
      return;
    }
    if (!parseYoutubeVideoId(youtubeUrl)) {
      setError('Enter a valid YouTube watch, share, Shorts, or embed link');
      return;
    }
    setError(null);
    try {
      const result = await importYoutube({
        role: user.role,
        body: {
          youtubeUrl: youtubeUrl.trim(),
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          visibility,
          lessonId,
          ...(moduleId ? { moduleId } : {}),
        },
      }).unwrap();
      setVideoId(result.video.id);
      setPhase('processing');
      toast.success('YouTube video queued. Processing started.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add YouTube video'));
    }
  }

  const busy = phase === 'uploading' || phase === 'processing';
  const youtubeId = parseYoutubeVideoId(youtubeUrl);
  const modeBusy = busy || linking || importingYoutube;
  const activeMode = mode === 'library' && !canAddFromLibrary ? 'upload' : mode;

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-full border border-blue-100 bg-slate-50 p-1">
        <button
          type="button"
          disabled={modeBusy}
          onClick={() => setMode('upload')}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            activeMode === 'upload' ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
          }`}
        >
          Upload new
        </button>
        <button
          type="button"
          disabled={modeBusy}
          onClick={() => setMode('youtube')}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            activeMode === 'youtube' ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
          }`}
        >
          YouTube link
        </button>
        {canAddFromLibrary ? (
          <button
            type="button"
            disabled={modeBusy}
            onClick={() => setMode('library')}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              activeMode === 'library' ? 'bg-white text-accent shadow-sm' : 'text-slate-600 hover:text-accent'
            }`}
          >
            Select from library
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {activeMode === 'youtube' ? (
        <div className="space-y-4">
          <Field label="YouTube link">
            <input
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className={inputClassName}
              disabled={modeBusy}
            />
          </Field>
          {youtubeId ? <YouTubeEmbed src={youtubeEmbedUrl(youtubeId)} /> : null}
          <Field label="Title">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Leave blank to use the YouTube title"
              className={inputClassName}
              disabled={modeBusy}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`${inputClassName} min-h-24`}
              disabled={modeBusy}
            />
          </Field>
          <Field label="Visibility">
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as VideoVisibility)}
              className={inputClassName}
              disabled={modeBusy}
            >
              <option value={VideoVisibility.PUBLIC}>Public</option>
              <option value={VideoVisibility.UNLISTED}>Unlisted</option>
              <option value={VideoVisibility.PRIVATE}>Private</option>
            </select>
          </Field>
          {phase !== 'idle' ? (
            <div className="space-y-3 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">
                  {phase === 'processing'
                    ? 'Downloading and processing YouTube video…'
                    : phase === 'done'
                      ? 'Video is ready'
                      : 'Upload issue'}
                </p>
                {status ? <StatusBadge status={status.status} /> : null}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-blue-50">
                <div
                  className="h-full bg-accent transition-all"
                  style={{
                    width: `${
                      status?.status === VideoStatus.READY ? 100 : Math.max(4, status?.progress ?? 0)
                    }%`,
                  }}
                />
              </div>
              <p className="text-sm text-slate-500">
                {status
                  ? `${statusCopy[status.status] ?? status.status}${
                      status.status === VideoStatus.PROCESSING ? ` · ${status.progress}%` : ''
                    }`
                  : 'Queued'}
              </p>
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={modeBusy}
              className="rounded-full border border-blue-100 px-4 py-2 text-sm text-slate-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void importFromYoutube()}
              disabled={modeBusy || !youtubeId}
              className={`${primaryButtonClassName} sm:w-auto sm:px-8`}
            >
              {importingYoutube || phase === 'processing' ? 'Working…' : 'Add YouTube video'}
            </button>
          </div>
        </div>
      ) : activeMode === 'library' ? (
        <div className="space-y-4">
          <VideoLibraryPicker
            lessonId={lessonId}
            selectedId={selectedLibraryVideo?.id}
            onSelect={setSelectedLibraryVideo}
            busy={linking}
          />
          <VideoLibraryConfirmActions
            selected={selectedLibraryVideo}
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
              accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv"
              className="hidden"
              onChange={(event) => onFiles(event.target.files)}
            />
            <p className="text-base font-medium text-slate-900">
              Drag and drop a video, or click to choose
            </p>
            <p className="mt-2 text-sm text-slate-500">MP4, WebM, MOV, or MKV</p>
          </div>

          {file ? (
            <div className="space-y-4 rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
              {previewUrl ? (
                <video src={previewUrl} controls className="w-full rounded-xl bg-black" />
              ) : null}
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
              <Field label="Visibility">
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as VideoVisibility)}
                  className={inputClassName}
                  disabled={busy}
                >
                  <option value={VideoVisibility.PUBLIC}>Public</option>
                  <option value={VideoVisibility.UNLISTED}>Unlisted</option>
                  <option value={VideoVisibility.PRIVATE}>Private</option>
                </select>
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
                      ? 'Video uploaded. Processing…'
                      : phase === 'done'
                        ? 'Video is ready'
                        : 'Upload issue'}
                </p>
                {status ? <StatusBadge status={status.status} /> : null}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-blue-50">
                <div
                  className="h-full bg-accent transition-all"
                  style={{
                    width: `${
                      phase === 'uploading'
                        ? uploadProgress
                        : status?.status === VideoStatus.READY
                          ? 100
                          : Math.max(uploadProgress === 100 ? 100 : 0, status?.progress ?? 0)
                    }%`,
                  }}
                />
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
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
