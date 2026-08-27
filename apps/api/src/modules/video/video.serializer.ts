import type { VideoDocument } from '../../models/index.js';
import { VideoSeenStatus, VideoStatus, VideoVisibility } from '@video/shared';
import type mongoose from 'mongoose';

type PopulatedDepartment = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string | null;
};

type PopulatedModule = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string | null;
  departmentId?: mongoose.Types.ObjectId | PopulatedDepartment | null;
};

type PopulatedLesson = {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug?: string | null;
};

function moduleFields(video: VideoDocument) {
  const raw = video.moduleId as unknown;
  if (!raw) {
    return {
      moduleId: null,
      moduleName: null,
      moduleSlug: null,
      departmentId: null,
      departmentName: null,
      departmentSlug: null,
    };
  }
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    const mod = raw as PopulatedModule;
    const departmentRaw = mod.departmentId as unknown;
    let departmentId: string | null = null;
    let departmentName: string | null = null;
    let departmentSlug: string | null = null;

    if (departmentRaw && typeof departmentRaw === 'object' && 'name' in departmentRaw) {
      const department = departmentRaw as PopulatedDepartment;
      departmentId = String(department._id);
      departmentName = department.name;
      departmentSlug = department.slug ?? null;
    } else if (departmentRaw) {
      departmentId = String(departmentRaw);
    }

    return {
      moduleId: String(mod._id),
      moduleName: mod.name,
      moduleSlug: mod.slug ?? null,
      departmentId,
      departmentName,
      departmentSlug,
    };
  }
  return {
    moduleId: String(raw),
    moduleName: null,
    moduleSlug: null,
    departmentId: null,
    departmentName: null,
    departmentSlug: null,
  };
}

function lessonFields(video: VideoDocument) {
  const raw = video.lessonId as unknown;
  if (!raw) {
    return { lessonId: null, lessonName: null, lessonSlug: null };
  }
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    const lesson = raw as PopulatedLesson;
    return {
      lessonId: String(lesson._id),
      lessonName: lesson.name,
      lessonSlug: lesson.slug ?? null,
    };
  }
  return {
    lessonId: String(raw),
    lessonName: null,
    lessonSlug: null,
  };
}

export function serializeVideo(video: VideoDocument, extra: Record<string, unknown> = {}) {
  return {
    id: String(video._id),
    slug: video.slug,
    title: video.title,
    description: video.description,
    originalFilename: video.originalFilename,
    status: video.status as VideoStatus,
    processingProgress: video.processingProgress,
    duration: video.duration ?? null,
    fileSize: video.fileSize,
    mimeType: video.mimeType,
    width: video.width ?? null,
    height: video.height ?? null,
    availableQualities: video.availableQualities ?? [],
    visibility: video.visibility as VideoVisibility,
    createdBy: String(video.createdBy),
    tenantId: String(video.tenantId),
    ...moduleFields(video),
    ...lessonFields(video),
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
    errorMessage: video.errorMessage ?? null,
    thumbnailUrl: video.thumbnailStorageKey ? `/api/videos/${String(video._id)}/thumbnail` : null,
    playbackUrl: video.status === VideoStatus.READY ? `/api/videos/${String(video._id)}/hls/master.m3u8` : null,
    seenStatus: VideoSeenStatus.PENDING,
    ...extra,
  };
}

export function serializeStatus(video: VideoDocument) {
  return {
    id: String(video._id),
    slug: video.slug,
    status: video.status,
    progress: video.processingProgress,
    errorMessage: video.errorMessage ?? null,
  };
}
