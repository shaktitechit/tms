import mongoose from 'mongoose';
import { AppError, ContentSeenStatus, ERROR_CODES, sanitizeOriginalFilename } from '@video/shared';
import { assertCanManageCurriculum } from '../../http/access.js';
import { notFound } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import type { PdfDocument } from '../../models/index.js';
import {
  extensionFromFilename,
  refId,
  resolveLessonObjectId,
} from '../content/content.utils.js';
import {
  appendLessonContentOrder,
  removeLessonContentOrder,
} from '../content/lesson-content-order.js';
import type { ParsedContentUpload } from '../content/content-upload.parser.js';
import { pdfSeenRepository } from './pdf-seen.repository.js';
import { serializePdf } from './pdf.serializer.js';
import { pdfRepository } from './pdf.repository.js';

type AuthActor = { id: string; role: string; tenantId: string; access?: string | null };

export class PdfService {
  constructor(private readonly ctx: AppContext) {}

  async list(actor: AuthActor, options?: { lesson?: string }) {
    let lessonId: string | undefined;
    if (options?.lesson) {
      lessonId = String(await this.requireLessonId(actor.tenantId, options.lesson));
    }
    const items = await pdfRepository.findByTenant(actor.tenantId, lessonId);
    return this.withSeenStatus(items, actor);
  }

  async getById(actor: AuthActor, ref: string) {
    const item = await this.requireItem(actor, ref);
    const [dto] = await this.withSeenStatus([item], actor);
    return dto;
  }

  async createFromUpload(actor: AuthActor, form: ParsedContentUpload) {
    assertCanManageCurriculum(actor);
    if (!form.stream || !form.filename) {
      throw new AppError('File is required', ERROR_CODES.INVALID_FILE, 400);
    }
    if (!form.title.trim()) {
      throw new AppError('Title is required', ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (!form.lessonId.trim()) {
      throw new AppError('Lesson is required', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const lessonId = await this.requireLessonId(actor.tenantId, form.lessonId);
    const id = new mongoose.Types.ObjectId();
    const filename = sanitizeOriginalFilename(form.filename);
    const ext = extensionFromFilename(filename);
    const storageKey = `pdfs/${String(id)}/original${ext}`;
    const slug = await pdfRepository.allocateSlug(actor.tenantId, form.title.trim());

    const pageCountRaw = form.extras.pageCount;
    const durationRaw = form.extras.duration;
    const pageCount =
      pageCountRaw !== undefined && pageCountRaw !== '' ? Number(pageCountRaw) : undefined;
    const duration =
      durationRaw !== undefined && durationRaw !== '' ? Number(durationRaw) : undefined;

    try {
      await this.ctx.storage.upload(storageKey, form.stream, {
        contentType: form.mimeType,
        contentLength: form.size > 0 ? form.size : undefined,
      });
    } catch (error) {
      throw error;
    }

    const item = await pdfRepository.create({
      _id: id,
      title: form.title.trim(),
      slug,
      description: form.description?.trim() ?? '',
      originalFilename: filename,
      storageKey,
      mimeType: form.mimeType,
      fileSize: form.size,
      pageCount: Number.isFinite(pageCount) ? pageCount : undefined,
      duration: Number.isFinite(duration) && duration! >= 0 ? duration : undefined,
      lessonId,
      createdBy: new mongoose.Types.ObjectId(actor.id),
      tenantId: new mongoose.Types.ObjectId(actor.tenantId),
    });
    await item.populate('lessonId', 'name slug');
    await appendLessonContentOrder(lessonId, 'pdf', item._id);
    return serializePdf(item);
  }

  async updateFromUpload(actor: AuthActor, ref: string, form: ParsedContentUpload) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireItem(actor, ref);
    const patch: Partial<PdfDocument> = {};

    if (form.title.trim()) {
      patch.title = form.title.trim();
    }
    if (form.description !== undefined) {
      patch.description = form.description.trim();
    }
    if (form.lessonId.trim()) {
      patch.lessonId = await this.requireLessonId(actor.tenantId, form.lessonId);
    }

    if (form.extras.pageCount !== undefined && form.extras.pageCount !== '') {
      const pageCount = Number(form.extras.pageCount);
      if (Number.isFinite(pageCount)) {
        patch.pageCount = pageCount;
      }
    }
    if (form.extras.duration !== undefined) {
      if (form.extras.duration === '' || form.extras.duration === 'null') {
        patch.duration = undefined;
      } else {
        const duration = Number(form.extras.duration);
        if (Number.isFinite(duration) && duration >= 0) {
          patch.duration = duration;
        }
      }
    }

    if (form.stream && form.filename) {
      const filename = sanitizeOriginalFilename(form.filename);
      const ext = extensionFromFilename(filename);
      const storageKey = `pdfs/${String(existing._id)}/original${ext}`;
      await this.ctx.storage.upload(storageKey, form.stream, {
        contentType: form.mimeType,
        contentLength: form.size > 0 ? form.size : undefined,
      });
      patch.originalFilename = filename;
      patch.storageKey = storageKey;
      patch.mimeType = form.mimeType;
      patch.fileSize = form.size;
    }

    const updated = await pdfRepository.updateById(
      String(existing._id),
      actor.tenantId,
      patch,
    );
    if (!updated) {
      throw notFound('Pdf not found', ERROR_CODES.NOT_FOUND);
    }
    return serializePdf(updated);
  }

  async update(
    actor: AuthActor,
    ref: string,
    patch: {
      title?: string;
      description?: string;
      lessonId?: string;
      pageCount?: number;
      duration?: number | null;
    },
  ) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireItem(actor, ref);

    if (patch.title !== undefined) {
      existing.title = patch.title.trim();
    }
    if (patch.description !== undefined) {
      existing.description = patch.description.trim();
    }
    if (patch.lessonId !== undefined) {
      existing.lessonId = await this.requireLessonId(actor.tenantId, patch.lessonId);
    }
    if (patch.pageCount !== undefined) {
      existing.pageCount = patch.pageCount;
    }
    if (patch.duration !== undefined) {
      if (patch.duration === null) {
        existing.set('duration', undefined);
      } else {
        existing.duration = patch.duration;
      }
    }

    await existing.save();
    await existing.populate('lessonId', 'name slug');
    return serializePdf(existing);
  }

  async remove(actor: AuthActor, ref: string) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireItem(actor, ref);
    await this.ctx.storage.deletePrefix(`pdfs/${String(existing._id)}/`);
    await pdfSeenRepository.deleteByPdfId(String(existing._id));
    await removeLessonContentOrder(refId(existing.lessonId), existing._id);
    await pdfRepository.deleteById(String(existing._id), actor.tenantId);
    return { deleted: true };
  }

  async markSeen(actor: AuthActor, ref: string) {
    const item = await this.requireItem(actor, ref);
    await pdfSeenRepository.upsertCompleted({
      pdfId: item._id,
      userId: actor.id,
      tenantId: actor.tenantId,
    });
    return serializePdf(item, { seenStatus: ContentSeenStatus.COMPLETED });
  }

  async pipeFile(actor: AuthActor, ref: string, res: import('express').Response) {
    const item = await this.requireItem(actor, ref);
    const exists = await this.ctx.storage.exists(item.storageKey);
    if (!exists) {
      throw notFound('File not found', ERROR_CODES.NOT_FOUND);
    }
    const metadata = await this.ctx.storage.getMetadata(item.storageKey);
    res.setHeader('Content-Type', metadata.contentType ?? item.mimeType);
    if (metadata.contentLength) {
      res.setHeader('Content-Length', String(metadata.contentLength));
    }
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${item.originalFilename.replace(/"/g, '')}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=86400');
    const body = await this.ctx.storage.download(item.storageKey);
    body.pipe(res);
  }

  private async withSeenStatus(items: PdfDocument[], actor: AuthActor) {
    const completed = await pdfSeenRepository.findCompletedByUserAndIds(
      actor.id,
      items.map((item) => item._id),
    );
    const completedIds = new Set(completed.map((row) => String(row.pdfId)));
    return items.map((item) =>
      serializePdf(item, {
        seenStatus: completedIds.has(String(item._id))
          ? ContentSeenStatus.COMPLETED
          : ContentSeenStatus.PENDING,
      }),
    );
  }

  private async requireItem(actor: AuthActor, ref: string) {
    const item = await pdfRepository.findByRef(ref, actor.tenantId);
    if (!item) {
      throw notFound('Pdf not found', ERROR_CODES.NOT_FOUND);
    }
    if (!item.slug) {
      item.slug = await pdfRepository.allocateSlug(actor.tenantId, item.title);
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
