import mongoose from 'mongoose';
import {
  AppError,
  AudioStatus,
  ContentSeenStatus,
  ERROR_CODES,
  buildAudioStorageKeys,
  getExtension,
  sanitizeOriginalFilename,
} from '@video/shared';
import { enqueueAudioProcessing, removeAudioProcessingJob } from '@video/shared/server';
import { assertCanManageCurriculum } from '../../http/access.js';
import { notFound } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import type { AudioDocument } from '../../models/index.js';
import { resolveLessonObjectId, refId } from '../content/content.utils.js';
import {
  appendLessonContentOrder,
  moveLessonContentOrder,
  removeLessonContentOrder,
} from '../content/lesson-content-order.js';
import type { ParsedContentUpload } from '../content/content-upload.parser.js';
import { pipeSeekableMedia } from '../content/pipe-seekable-media.js';
import { audioSeenRepository } from './audio-seen.repository.js';
import { serializeAudio, serializeAudioStatus } from './audio.serializer.js';
import { audioRepository } from './audio.repository.js';

type AuthActor = { id: string; role: string; tenantId: string; access?: string | null };

export class AudioService {
  constructor(private readonly ctx: AppContext) {}

  async list(actor: AuthActor, options?: { lesson?: string }) {
    let lessonId: string | undefined;
    if (options?.lesson) {
      lessonId = String(await this.requireLessonId(actor.tenantId, options.lesson));
    }
    const items = await audioRepository.findByTenant(actor.tenantId, lessonId);
    return this.withSeenStatus(items, actor);
  }

  async getById(actor: AuthActor, ref: string) {
    const item = await this.requireItem(actor, ref);
    const [dto] = await this.withSeenStatus([item], actor);
    return dto;
  }

  async getStatus(actor: AuthActor, ref: string) {
    const item = await this.requireItem(actor, ref);
    return serializeAudioStatus(item);
  }

  async createFromUpload(actor: AuthActor, form: ParsedContentUpload) {
    assertCanManageCurriculum(actor);
    if (!form.stream || !form.filename) {
      throw new AppError('File is required', ERROR_CODES.INVALID_FILE, 400);
    }
    if (!form.title.trim()) {
      throw new AppError('Title is required', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const lessonId = form.lessonId.trim()
      ? await this.requireLessonId(actor.tenantId, form.lessonId)
      : null;
    const id = new mongoose.Types.ObjectId();
    const filename = sanitizeOriginalFilename(form.filename);
    const ext = getExtension(filename);
    const keys = buildAudioStorageKeys(String(id), ext);
    const slug = await audioRepository.allocateSlug(actor.tenantId, form.title.trim());

    const item = await audioRepository.create({
      _id: id,
      title: form.title.trim(),
      slug,
      description: form.description?.trim() ?? '',
      originalFilename: filename,
      storageKey: keys.original,
      mimeType: form.mimeType,
      fileSize: form.size,
      status: AudioStatus.UPLOADING,
      processingProgress: 0,
      availableQualities: [],
      ...(lessonId ? { lessonId } : {}),
      createdBy: new mongoose.Types.ObjectId(actor.id),
      tenantId: new mongoose.Types.ObjectId(actor.tenantId),
    });

    try {
      await this.ctx.storage.upload(keys.original, form.stream, {
        contentType: form.mimeType,
        // Prefer client-declared size; never use multipart Content-Length.
        contentLength: form.size > 0 ? form.size : undefined,
      });
    } catch (error) {
      await audioRepository.deleteById(String(id), actor.tenantId);
      throw error;
    }

    item.status = AudioStatus.UPLOADED;
    await item.save();

    try {
      await enqueueAudioProcessing(this.ctx.audioQueue, String(id));
    } catch (error) {
      this.ctx.logger.error({ err: error, audioId: String(id) }, 'Failed to enqueue audio processing');
      item.status = AudioStatus.FAILED;
      item.errorMessage = 'Failed to enqueue processing job';
      await item.save();
      throw new AppError('Failed to enqueue processing job', ERROR_CODES.QUEUE_ERROR, 502);
    }

    item.status = AudioStatus.QUEUED;
    await item.save();
    if (lessonId) {
      await item.populate('lessonId', 'name slug');
      await appendLessonContentOrder(lessonId, 'audio', item._id);
    }
    return serializeAudio(item);
  }

  async updateFromUpload(actor: AuthActor, ref: string, form: ParsedContentUpload) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireItem(actor, ref);
    const patch: Partial<AudioDocument> = {};
    let reprocess = false;
    const previousLessonId = refId(existing.lessonId);

    if (form.title.trim()) {
      patch.title = form.title.trim();
    }
    if (form.description !== undefined) {
      patch.description = form.description.trim();
    }
    if (form.lessonId.trim()) {
      patch.lessonId = await this.requireLessonId(actor.tenantId, form.lessonId);
    }

    if (form.stream && form.filename) {
      const filename = sanitizeOriginalFilename(form.filename);
      const ext = getExtension(filename);
      const keys = buildAudioStorageKeys(String(existing._id), ext);
      await this.ctx.storage.upload(keys.original, form.stream, {
        contentType: form.mimeType,
        contentLength: form.size > 0 ? form.size : undefined,
      });
      patch.originalFilename = filename;
      patch.storageKey = keys.original;
      patch.mimeType = form.mimeType;
      patch.fileSize = form.size;
      patch.status = AudioStatus.UPLOADED;
      patch.processingProgress = 0;
      patch.hlsMasterPlaylistKey = undefined;
      patch.availableQualities = [];
      patch.errorMessage = undefined;
      reprocess = true;
    }

    const updated = await audioRepository.updateById(
      String(existing._id),
      actor.tenantId,
      patch,
    );
    if (!updated) {
      throw notFound('Audio not found', ERROR_CODES.NOT_FOUND);
    }

    if (patch.lessonId !== undefined) {
      await moveLessonContentOrder(previousLessonId, patch.lessonId, 'audio', existing._id);
    }

    if (reprocess) {
      try {
        await removeAudioProcessingJob(this.ctx.audioQueue, String(updated._id));
        await enqueueAudioProcessing(this.ctx.audioQueue, String(updated._id));
        updated.status = AudioStatus.QUEUED;
        await updated.save();
      } catch (error) {
        this.ctx.logger.error(
          { err: error, audioId: String(updated._id) },
          'Failed to re-enqueue audio processing',
        );
        updated.status = AudioStatus.FAILED;
        updated.errorMessage = 'Failed to enqueue processing job';
        await updated.save();
        throw new AppError('Failed to enqueue processing job', ERROR_CODES.QUEUE_ERROR, 502);
      }
    }

    return serializeAudio(updated);
  }

  async update(
    actor: AuthActor,
    ref: string,
    patch: { title?: string; description?: string; lessonId?: string | null },
  ) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireItem(actor, ref);
    const previousLessonId = refId(existing.lessonId);

    if (patch.title !== undefined) {
      existing.title = patch.title.trim();
    }
    if (patch.description !== undefined) {
      existing.description = patch.description.trim();
    }
    if (patch.lessonId !== undefined) {
      if (patch.lessonId === null) {
        existing.set('lessonId', undefined);
      } else {
        existing.lessonId = await this.requireLessonId(actor.tenantId, patch.lessonId);
      }
    }

    await existing.save();

    if (patch.lessonId !== undefined) {
      await moveLessonContentOrder(previousLessonId, refId(existing.lessonId), 'audio', existing._id);
    }

    await existing.populate('lessonId', 'name slug');
    return serializeAudio(existing);
  }

  async remove(actor: AuthActor, ref: string) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireItem(actor, ref);
    const keys = buildAudioStorageKeys(String(existing._id));
    await removeAudioProcessingJob(this.ctx.audioQueue, String(existing._id));
    await this.ctx.storage.deletePrefix(`${keys.prefix}/`);
    await audioSeenRepository.deleteByAudioId(String(existing._id));
    await removeLessonContentOrder(refId(existing.lessonId), existing._id);
    await audioRepository.deleteById(String(existing._id), actor.tenantId);
    return { deleted: true };
  }

  async markSeen(actor: AuthActor, ref: string) {
    const item = await this.requireItem(actor, ref);
    await audioSeenRepository.upsertCompleted({
      audioId: item._id,
      userId: actor.id,
      tenantId: actor.tenantId,
    });
    return serializeAudio(item, { seenStatus: ContentSeenStatus.COMPLETED });
  }

  async pipeStream(
    actor: AuthActor,
    ref: string,
    req: import('express').Request,
    res: import('express').Response,
  ) {
    const item = await this.requireItem(actor, ref);
    await pipeSeekableMedia(this.ctx, req, res, {
      storageKey: item.storageKey,
      mimeType: item.mimeType,
      filename: item.originalFilename,
      fileSize: item.fileSize,
    });
  }

  async pipeFile(
    actor: AuthActor,
    ref: string,
    req: import('express').Request,
    res: import('express').Response,
  ) {
    return this.pipeStream(actor, ref, req, res);
  }

  private async withSeenStatus(items: AudioDocument[], actor: AuthActor) {
    const completed = await audioSeenRepository.findCompletedByUserAndIds(
      actor.id,
      items.map((item) => item._id),
    );
    const completedIds = new Set(completed.map((row) => String(row.audioId)));
    return items.map((item) =>
      serializeAudio(item, {
        seenStatus: completedIds.has(String(item._id))
          ? ContentSeenStatus.COMPLETED
          : ContentSeenStatus.PENDING,
      }),
    );
  }

  private async requireItem(actor: AuthActor, ref: string) {
    const item = await audioRepository.findByRef(ref, actor.tenantId);
    if (!item) {
      throw notFound('Audio not found', ERROR_CODES.NOT_FOUND);
    }
    if (!item.slug) {
      item.slug = await audioRepository.allocateSlug(actor.tenantId, item.title);
      await item.save();
    }
    return item;
  }

  private async requireLessonId(tenantId: string, lessonRef: string) {
    const lesson = await resolveLessonObjectId(tenantId, lessonRef);
    if (!lesson) {
      throw notFound('Lesson not found', ERROR_CODES.NOT_FOUND);
    }
    return lesson._id;
  }
}
