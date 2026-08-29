export enum VideoStatus {
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum VideoVisibility {
  PUBLIC = 'PUBLIC',
  UNLISTED = 'UNLISTED',
  PRIVATE = 'PRIVATE',
}

/** Per-viewer progress for lesson content. Defaults to pending until completed. */
export enum ContentSeenStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

/** @deprecated Prefer ContentSeenStatus — kept for existing video callers. */
export const VideoSeenStatus = ContentSeenStatus;
export type VideoSeenStatus = ContentSeenStatus;

export enum VideoQuality {
  P360 = '360p',
  P480 = '480p',
  P720 = '720p',
  P1080 = '1080p',
}

/** Roles within a tenant: `tenant` owns/administers the org; `user` is a member. */
export enum UserRole {
  TENANT = 'tenant',
  USER = 'user',
}

/** Access level for members with `UserRole.USER`. Tenant admins do not use this. */
export enum MemberAccess {
  LEARNER = 'learner',
  TUTOR = 'tutor',
}

export interface QualityLadderEntry {
  name: VideoQuality;
  height: number;
  width: number;
  maxrate: string;
  bufsize: string;
  audioBitrate: string;
  bandwidth: number;
}

export interface VideoProcessingJobData {
  videoId: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code: string;
}

export interface VideoStatusResponse {
  id: string;
  status: VideoStatus;
  progress: number;
  errorMessage?: string;
}

export const VIDEO_PROCESSING_QUEUE = 'video-processing';

export const VIDEO_QUALITIES = [
  VideoQuality.P360,
  VideoQuality.P480,
  VideoQuality.P720,
  VideoQuality.P1080,
] as const;

/** Same lifecycle as video processing for lesson audio HLS. */
export enum AudioStatus {
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export enum AudioQuality {
  K96 = '96k',
  K128 = '128k',
  K192 = '192k',
}

export interface AudioQualityLadderEntry {
  name: AudioQuality;
  audioBitrate: string;
  bandwidth: number;
}

export interface AudioProcessingJobData {
  audioId: string;
}

export interface AudioStatusResponse {
  id: string;
  status: AudioStatus;
  progress: number;
  errorMessage?: string;
}

export const AUDIO_PROCESSING_QUEUE = 'audio-processing';

export interface SessionRecordingJobData {
  liveSessionId: string;
  tenantId: string;
  hostId: string;
  title: string;
  description: string;
  segmentKeys: string[];
}

export const SESSION_RECORDING_QUEUE = 'session-recording';

export const AUDIO_QUALITIES = [
  AudioQuality.K96,
  AudioQuality.K128,
  AudioQuality.K192,
] as const;
