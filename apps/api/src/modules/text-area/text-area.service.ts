import mongoose from 'mongoose';
import { ContentSeenStatus, ERROR_CODES } from '@video/shared';
import { assertCanManageCurriculum } from '../../http/access.js';
import { notFound } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import type { TextAreaDocument } from '../../models/index.js';
import { resolveLessonObjectId } from '../content/content.utils.js';
import {
  appendLessonContentOrder,
  removeLessonContentOrder,
} from '../content/lesson-content-order.js';
import { textAreaSeenRepository } from './text-area-seen.repository.js';
import { serializeTextArea } from './text-area.serializer.js';
import { textAreaRepository } from './text-area.repository.js';

type AuthActor = { id: string; role: string; tenantId: string; access?: string | null };

export class TextAreaService {
  constructor(private readonly ctx: AppContext) {}

  async list(actor: AuthActor, options?: { lesson?: string }) {
    let lessonId: string | undefined;
    if (options?.lesson) {
      lessonId = String(await this.requireLessonId(actor.tenantId, options.lesson));
    }
    const items = await textAreaRepository.findByTenant(actor.tenantId, lessonId);
    return this.withSeenStatus(items, actor);
  }

  async getById(actor: AuthActor, ref: string) {
    const item = await this.requireItem(actor, ref);
    const [dto] = await this.withSeenStatus([item], actor);
    return dto;
  }

  async create(
    actor: AuthActor,
    input: {
      title: string;
      description?: string;
      body: string;
      duration?: number | null;
      lessonId: string;
    },
  ) {
    assertCanManageCurriculum(actor);
    const lessonId = await this.requireLessonId(actor.tenantId, input.lessonId);
    const slug = await textAreaRepository.allocateSlug(actor.tenantId, input.title.trim());
    const item = await textAreaRepository.create({
      title: input.title.trim(),
      slug,
      description: input.description?.trim() ?? '',
      body: input.body,
      duration: input.duration ?? null,
      lessonId,
      createdBy: new mongoose.Types.ObjectId(actor.id),
      tenantId: new mongoose.Types.ObjectId(actor.tenantId),
    });
    await item.populate('lessonId', 'name slug');
    await appendLessonContentOrder(lessonId, 'text', item._id);
    return serializeTextArea(item);
  }

  async update(
    actor: AuthActor,
    ref: string,
    patch: {
      title?: string;
      description?: string;
      body?: string;
      duration?: number | null;
      lessonId?: string;
    },
  ) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireItem(actor, ref);
    const updates: Partial<TextAreaDocument> = {};
    if (patch.title !== undefined) {
      updates.title = patch.title.trim();
    }
    if (patch.description !== undefined) {
      updates.description = patch.description.trim();
    }
    if (patch.body !== undefined) {
      updates.body = patch.body;
    }
    if (patch.duration !== undefined) {
      updates.duration = patch.duration;
    }
    if (patch.lessonId !== undefined) {
      updates.lessonId = await this.requireLessonId(actor.tenantId, patch.lessonId);
    }
    const updated = await textAreaRepository.updateById(
      String(existing._id),
      actor.tenantId,
      updates,
    );
    if (!updated) {
      throw notFound('Text area not found', ERROR_CODES.NOT_FOUND);
    }
    return serializeTextArea(updated);
  }

  async remove(actor: AuthActor, ref: string) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireItem(actor, ref);
    await removeLessonContentOrder(existing.lessonId, existing._id);
    await textAreaSeenRepository.deleteByTextAreaId(String(existing._id));
    await textAreaRepository.deleteById(String(existing._id), actor.tenantId);
    return { deleted: true };
  }

  async markSeen(actor: AuthActor, ref: string) {
    const item = await this.requireItem(actor, ref);
    await textAreaSeenRepository.upsertCompleted({
      textAreaId: item._id,
      userId: actor.id,
      tenantId: actor.tenantId,
    });
    return serializeTextArea(item, { seenStatus: ContentSeenStatus.COMPLETED });
  }

  private async withSeenStatus(items: TextAreaDocument[], actor: AuthActor) {
    const completed = await textAreaSeenRepository.findCompletedByUserAndIds(
      actor.id,
      items.map((item) => item._id),
    );
    const completedIds = new Set(completed.map((row) => String(row.textAreaId)));
    return items.map((item) =>
      serializeTextArea(item, {
        seenStatus: completedIds.has(String(item._id))
          ? ContentSeenStatus.COMPLETED
          : ContentSeenStatus.PENDING,
      }),
    );
  }

  private async requireItem(actor: AuthActor, ref: string) {
    const item = await textAreaRepository.findByRef(ref, actor.tenantId);
    if (!item) {
      throw notFound('Text area not found', ERROR_CODES.NOT_FOUND);
    }
    if (!item.slug) {
      item.slug = await textAreaRepository.allocateSlug(actor.tenantId, item.title);
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
