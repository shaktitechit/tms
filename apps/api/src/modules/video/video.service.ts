import mongoose from 'mongoose';
import {
  AppError,
  ERROR_CODES,
  UserRole,
  VideoSeenStatus,
  VideoStatus,
  VideoVisibility,
  buildStorageKeys,
  canWatchVideo,
  sanitizeOriginalFilename,
} from '@video/shared';
import { csvList, enqueueVideoProcessing, removeVideoProcessingJob } from '@video/shared/server';
import type { Readable } from 'node:stream';
import { forbidden, notFound, unauthorized } from '../../http/errors.js';
import { isTutorActor } from '../../http/access.js';
import type { AppContext } from '../../types.js';
import type { VideoDocument } from '../../models/index.js';
import { moduleRepository } from '../module/module.repository.js';
import { lessonRepository } from '../lesson/lesson.repository.js';
import { refId } from '../content/content.utils.js';
import {
  appendLessonContentOrder,
  moveLessonContentOrder,
  removeLessonContentOrder,
} from '../content/lesson-content-order.js';
import { discussionRepository } from '../discussion/discussion.repository.js';
import { serializeStatus, serializeVideo } from './video.serializer.js';
import { videoSeenRepository } from './video-seen.repository.js';
import { videoRepository } from './video.repository.js';

type Actor = { id: string; role: string; tenantId: string; access?: string | null };

export class VideoService {
  constructor(private readonly ctx: AppContext) {}

  async createFromUpload(input: {
    userId: string;
    tenantId: string;
    title: string;
    description: string;
    visibility: VideoVisibility;
    moduleId?: string;
    lessonId?: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    body: Readable;
  }) {
    const videoId = new mongoose.Types.ObjectId();
    const keys = buildStorageKeys(String(videoId));
    const filename = sanitizeOriginalFilename(input.originalFilename);
    const title = input.title || filename;
    const slug = await videoRepository.allocateSlug(input.tenantId, title);
    const moduleId = await this.resolveModuleId(input.tenantId, input.moduleId);
    const lessonId = await this.resolveLessonId(input.tenantId, input.lessonId);

    const video = await videoRepository.create({
      _id: videoId,
      title,
      slug,
      description: input.description,
      originalFilename: filename,
      originalStorageKey: keys.original,
      status: VideoStatus.UPLOADING,
      processingProgress: 0,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      visibility: input.visibility,
      moduleId,
      lessonId,
      createdBy: new mongoose.Types.ObjectId(input.userId),
      tenantId: new mongoose.Types.ObjectId(input.tenantId),
      availableQualities: [],
    });

    try {
      await this.ctx.storage.upload(keys.original, input.body, {
        contentType: input.mimeType,
        contentLength: input.fileSize > 0 ? input.fileSize : undefined,
      });
    } catch (error) {
      await videoRepository.deleteById(String(videoId));
      throw error;
    }

    video.status = VideoStatus.UPLOADED;
    await video.save();

    try {
      await enqueueVideoProcessing(this.ctx.queue, String(videoId));
    } catch (error) {
      this.ctx.logger.error({ err: error, videoId: String(videoId) }, 'Failed to enqueue processing job');
      video.status = VideoStatus.FAILED;
      video.errorMessage = 'Failed to enqueue processing job';
      await video.save();
      throw new AppError('Failed to enqueue processing job', ERROR_CODES.QUEUE_ERROR, 502);
    }

    video.status = VideoStatus.QUEUED;
    await video.save();

    if (lessonId) {
      await appendLessonContentOrder(lessonId, 'video', video._id);
    }

    return serializeVideo(video);
  }

  /** Tenant admin: every video belonging to the tenant. */
  async listForTenant(
    actor: Actor,
    options?: { status?: string; module?: string; lesson?: string },
  ) {
    this.assertTenantAdmin(actor);
    const query: Record<string, unknown> = { tenantId: actor.tenantId };
    if (options?.status) {
      query.status = options.status;
    }
    if (options?.module) {
      query.moduleId = await this.resolveModuleId(actor.tenantId, options.module);
    }
    if (options?.lesson) {
      query.lessonId = await this.resolveLessonId(actor.tenantId, options.lesson);
    }
    const videos = await videoRepository.find(query);
    return this.withSeenStatus(videos, actor);
  }

  /** Member user: all videos belonging to their tenant. */
  async listForUser(
    actor: Actor,
    options?: { status?: string; module?: string; lesson?: string },
  ) {
    this.assertTenantMember(actor);
    const query: Record<string, unknown> = { tenantId: actor.tenantId };
    if (options?.status) {
      query.status = options.status;
    }
    if (options?.module) {
      query.moduleId = await this.resolveModuleId(actor.tenantId, options.module);
    }
    if (options?.lesson) {
      query.lessonId = await this.resolveLessonId(actor.tenantId, options.lesson);
    }
    const videos = await videoRepository.find(query);
    return this.withSeenStatus(videos, actor);
  }

  /** Public / shared catalog (optional auth). */
  async listPublic(status?: string) {
    const videos = await videoRepository.find({
      visibility: VideoVisibility.PUBLIC,
      status: status ?? VideoStatus.READY,
    });
    return videos.map((video) => serializeVideo(video));
  }

  async getForTenant(id: string, actor: Actor) {
    this.assertTenantAdmin(actor);
    const video = await this.requireVideo(id, actor.tenantId);
    this.assertSameTenant(video, actor);
    const [dto] = await this.withSeenStatus([video], actor);
    return { video, dto };
  }

  async getForUser(id: string, actor: Actor) {
    this.assertTenantMember(actor);
    const video = await this.requireVideo(id, actor.tenantId);
    this.assertSameTenant(video, actor);
    const [dto] = await this.withSeenStatus([video], actor);
    return { video, dto };
  }

  async getById(id: string, user?: { id: string; role: string; tenantId?: string }) {
    const video = await this.requireVideo(id, user?.tenantId);
    if (
      !canWatchVideo(
        video.visibility,
        String(video.createdBy),
        user,
        String(video.tenantId),
      )
    ) {
      throw forbidden('This video is private');
    }
    return { video, dto: serializeVideo(video) };
  }

  async getStatus(id: string, user?: { id: string; role: string; tenantId?: string }) {
    const { video } = await this.getById(id, user);
    return serializeStatus(video);
  }

  async getStatusForTenant(id: string, actor: Actor) {
    const { video } = await this.getForTenant(id, actor);
    return serializeStatus(video);
  }

  async getStatusForUser(id: string, actor: Actor) {
    const { video } = await this.getForUser(id, actor);
    return serializeStatus(video);
  }

  async updateForTenant(
    id: string,
    actor: Actor,
    patch: {
      title?: string;
      description?: string;
      visibility?: VideoVisibility;
      moduleId?: string | null;
      lessonId?: string | null;
    },
  ) {
    this.assertTenantAdmin(actor);
    const video = await this.requireVideo(id, actor.tenantId);
    this.assertSameTenant(video, actor);

    if (patch.title !== undefined) {
      video.title = patch.title;
    }
    if (patch.description !== undefined) {
      video.description = patch.description;
    }
    if (patch.visibility !== undefined) {
      video.visibility = patch.visibility;
    }
    if (patch.moduleId !== undefined) {
      if (patch.moduleId === null) {
        video.set('moduleId', undefined);
      } else {
        video.moduleId = await this.resolveModuleId(actor.tenantId, patch.moduleId);
      }
    }
    if (patch.lessonId !== undefined) {
      const previousLessonId = refId(video.lessonId);
      if (patch.lessonId === null) {
        video.set('lessonId', undefined);
        await moveLessonContentOrder(previousLessonId, null, 'video', video._id);
      } else {
        video.lessonId = await this.resolveLessonId(actor.tenantId, patch.lessonId);
        await moveLessonContentOrder(previousLessonId, video.lessonId, 'video', video._id);
      }
    }

    await video.save();
    await video.populate([
      {
        path: 'moduleId',
        select: 'name slug departmentId',
        populate: { path: 'departmentId', select: 'name slug' },
      },
      { path: 'lessonId', select: 'name slug' },
    ]);
    return serializeVideo(video);
  }

  async updateForUser(
    id: string,
    actor: Actor,
    patch: {
      title?: string;
      description?: string;
      visibility?: VideoVisibility;
      moduleId?: string | null;
      lessonId?: string | null;
    },
  ) {
    this.assertTenantMember(actor);
    const video = await this.requireVideo(id, actor.tenantId);
    this.assertSameTenant(video, actor);
    if (!isTutorActor(actor)) {
      this.assertOwner(video, actor);
    }
    if (patch.title !== undefined) {
      video.title = patch.title;
    }
    if (patch.description !== undefined) {
      video.description = patch.description;
    }
    if (patch.visibility !== undefined) {
      video.visibility = patch.visibility;
    }
    if (patch.moduleId !== undefined) {
      if (patch.moduleId === null) {
        video.set('moduleId', undefined);
      } else {
        video.moduleId = await this.resolveModuleId(actor.tenantId, patch.moduleId);
      }
    }
    if (patch.lessonId !== undefined) {
      const previousLessonId = refId(video.lessonId);
      if (patch.lessonId === null) {
        video.set('lessonId', undefined);
        await moveLessonContentOrder(previousLessonId, null, 'video', video._id);
      } else {
        video.lessonId = await this.resolveLessonId(actor.tenantId, patch.lessonId);
        await moveLessonContentOrder(previousLessonId, video.lessonId, 'video', video._id);
      }
    }
    await video.save();
    await video.populate([
      {
        path: 'moduleId',
        select: 'name slug departmentId',
        populate: { path: 'departmentId', select: 'name slug' },
      },
      { path: 'lessonId', select: 'name slug' },
    ]);
    return serializeVideo(video);
  }

  async markSeenForTenant(id: string, actor: Actor) {
    this.assertTenantAdmin(actor);
    return this.markSeen(id, actor);
  }

  async markSeenForUser(id: string, actor: Actor) {
    this.assertTenantMember(actor);
    return this.markSeen(id, actor);
  }

  async deleteForTenant(id: string, actor: Actor) {
    this.assertTenantAdmin(actor);
    const video = await videoRepository.findByRef(id, actor.tenantId);
    if (!video) {
      return { deleted: true };
    }
    this.assertSameTenant(video, actor);
    return this.destroyVideo(video);
  }

  async deleteForUser(id: string, actor: Actor) {
    this.assertTenantMember(actor);
    const video = await videoRepository.findByRef(id, actor.tenantId);
    if (!video) {
      return { deleted: true };
    }
    this.assertSameTenant(video, actor);
    if (!isTutorActor(actor)) {
      this.assertOwner(video, actor);
    }
    return this.destroyVideo(video);
  }

  /** @deprecated Prefer deleteForTenant / deleteForUser */
  async delete(id: string, user?: { id: string; role: string; tenantId?: string }) {
    if (!user?.tenantId) {
      throw unauthorized();
    }
    const actor = user as Actor;
    if (actor.role === UserRole.TENANT) {
      return this.deleteForTenant(id, actor);
    }
    return this.deleteForUser(id, actor);
  }

  parseMimeAllowList(): string[] {
    return csvList(this.ctx.env.ALLOWED_VIDEO_MIME_TYPES);
  }

  parseExtensionAllowList(): string[] {
    return csvList(this.ctx.env.ALLOWED_VIDEO_EXTENSIONS);
  }

  private async requireVideo(ref: string, tenantId?: string) {
    const video = await videoRepository.findByRef(ref, tenantId);
    if (!video) {
      throw notFound('Video not found', ERROR_CODES.VIDEO_NOT_FOUND);
    }
    if (!video.slug) {
      video.slug = await videoRepository.allocateSlug(String(video.tenantId), video.title);
      await video.save();
    }
    return video;
  }

  private async destroyVideo(video: {
    _id: { toString(): string };
    lessonId?: unknown;
  }) {
    const keys = buildStorageKeys(String(video._id));
    await removeVideoProcessingJob(this.ctx.queue, String(video._id));
    await this.ctx.storage.deletePrefix(keys.prefix);
    await discussionRepository.deleteByVideoId(String(video._id));
    await videoSeenRepository.deleteByVideoId(String(video._id));
    const lessonId = refId(video.lessonId);
    if (lessonId) {
      await removeLessonContentOrder(lessonId, String(video._id));
    }
    await videoRepository.deleteById(String(video._id));
    return { deleted: true };
  }

  private async resolveModuleId(tenantId: string, moduleRef?: string) {
    const ref = moduleRef?.trim();
    if (!ref) {
      return undefined;
    }
    const mod = await moduleRepository.findByRef(ref, tenantId);
    if (!mod) {
      throw notFound('Module not found', ERROR_CODES.NOT_FOUND);
    }
    return mod._id;
  }

  private async resolveLessonId(tenantId: string, lessonRef?: string) {
    const ref = lessonRef?.trim();
    if (!ref) {
      return undefined;
    }
    const lesson = await lessonRepository.findByRef(ref, tenantId);
    if (!lesson) {
      throw notFound('Lesson not found', ERROR_CODES.NOT_FOUND);
    }
    return lesson._id;
  }

  private async withSeenStatus(videos: VideoDocument[], actor: Actor) {
    const completed = await videoSeenRepository.findCompletedByUserAndVideoIds(
      actor.id,
      videos.map((video) => video._id),
    );
    const completedIds = new Set(completed.map((row) => String(row.videoId)));
    return videos.map((video) =>
      serializeVideo(video, {
        seenStatus: completedIds.has(String(video._id))
          ? VideoSeenStatus.COMPLETED
          : VideoSeenStatus.PENDING,
      }),
    );
  }

  private async markSeen(id: string, actor: Actor) {
    const video = await this.requireVideo(id, actor.tenantId);
    this.assertSameTenant(video, actor);
    await videoSeenRepository.upsertCompleted({
      videoId: video._id,
      userId: actor.id,
      tenantId: actor.tenantId,
    });
    return serializeVideo(video, { seenStatus: VideoSeenStatus.COMPLETED });
  }

  private assertTenantAdmin(actor: Actor) {
    if (actor.role !== UserRole.TENANT) {
      throw forbidden('Tenant admin access required');
    }
  }

  private assertTenantMember(actor: Actor) {
    if (actor.role !== UserRole.USER) {
      throw forbidden('Member user access required');
    }
  }

  private assertSameTenant(
    video: { tenantId: { toString(): string } },
    actor: Actor,
  ) {
    if (String(video.tenantId) !== actor.tenantId) {
      throw forbidden();
    }
  }

  private assertOwner(video: { createdBy: { toString(): string } }, actor: Actor) {
    if (String(video.createdBy) !== actor.id) {
      throw forbidden();
    }
  }
}
