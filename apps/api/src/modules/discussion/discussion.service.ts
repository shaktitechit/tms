import mongoose from 'mongoose';
import { ERROR_CODES } from '@video/shared';
import { canManageCurriculum } from '../../http/access.js';
import { AppError, forbidden, notFound } from '../../http/errors.js';
import { lessonRepository } from '../lesson/lesson.repository.js';
import { videoRepository } from '../video/video.repository.js';
import { discussionRepository } from './discussion.repository.js';
import { serializeDiscussion } from './discussion.serializer.js';

type AuthActor = { id: string; role: string; tenantId: string; access?: string | null };

type Scope =
  | { kind: 'video'; id: mongoose.Types.ObjectId }
  | { kind: 'lesson'; id: mongoose.Types.ObjectId };

export class DiscussionService {
  async list(
    actor: AuthActor,
    options: { videoId?: string; lessonId?: string; parentId?: string },
  ) {
    const scope = await this.requireScope(actor, options);
    const query: Record<string, unknown> = {
      tenantId: actor.tenantId,
      ...(scope.kind === 'video' ? { videoId: scope.id } : { lessonId: scope.id }),
    };

    if (options.parentId !== undefined) {
      if (!discussionRepository.isObjectIdString(options.parentId)) {
        throw new AppError('Invalid parentId', ERROR_CODES.VALIDATION_ERROR, 400);
      }
      query.parentId = options.parentId;
    }

    const discussions = await discussionRepository.find(query);
    return discussions.map((discussion) => serializeDiscussion(discussion));
  }

  async getById(actor: AuthActor, id: string) {
    const discussion = await this.requireDiscussion(actor, id);
    return serializeDiscussion(discussion);
  }

  async create(
    actor: AuthActor,
    input: { videoId?: string; lessonId?: string; body: string; parentId?: string },
  ) {
    const scope = await this.requireScope(actor, input);
    const parent = await this.requireParent(actor, scope, input.parentId);

    const discussion = await discussionRepository.create({
      body: input.body.trim(),
      ...(scope.kind === 'video' ? { videoId: scope.id } : { lessonId: scope.id }),
      tenantId: new mongoose.Types.ObjectId(actor.tenantId),
      createdBy: new mongoose.Types.ObjectId(actor.id),
      parentId: parent?._id,
    });

    await discussion.populate('createdBy', 'name username');
    return serializeDiscussion(discussion);
  }

  async update(actor: AuthActor, id: string, patch: { body: string }) {
    const existing = await this.requireDiscussion(actor, id);
    if (this.authorId(existing) !== actor.id) {
      throw forbidden();
    }

    const updated = await discussionRepository.updateById(String(existing._id), actor.tenantId, {
      body: patch.body.trim(),
    });
    if (!updated) {
      throw notFound('Discussion not found', ERROR_CODES.NOT_FOUND);
    }
    return serializeDiscussion(updated);
  }

  async remove(actor: AuthActor, id: string) {
    const existing = await this.requireDiscussion(actor, id);
    const isAuthor = this.authorId(existing) === actor.id;
    if (!isAuthor && !canManageCurriculum(actor)) {
      throw forbidden();
    }

    await discussionRepository.deleteThread(String(existing._id), actor.tenantId);
    return { deleted: true };
  }

  private async requireScope(
    actor: AuthActor,
    input: { videoId?: string; lessonId?: string },
  ): Promise<Scope> {
    const hasVideo = Boolean(input.videoId?.trim());
    const hasLesson = Boolean(input.lessonId?.trim());
    if (hasVideo === hasLesson) {
      throw new AppError(
        'Provide exactly one of videoId or lessonId',
        ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }

    if (hasVideo) {
      const video = await videoRepository.findByRef(input.videoId!.trim(), actor.tenantId);
      if (!video || String(video.tenantId) !== actor.tenantId) {
        throw notFound('Video not found', ERROR_CODES.VIDEO_NOT_FOUND);
      }
      return { kind: 'video', id: video._id };
    }

    const lesson = await lessonRepository.findByRef(input.lessonId!.trim(), actor.tenantId);
    if (!lesson || String(lesson.tenantId) !== actor.tenantId) {
      throw notFound('Lesson not found', ERROR_CODES.NOT_FOUND);
    }
    return { kind: 'lesson', id: lesson._id };
  }

  private async requireDiscussion(actor: AuthActor, id: string) {
    if (!discussionRepository.isObjectIdString(id)) {
      throw notFound('Discussion not found', ERROR_CODES.NOT_FOUND);
    }
    const discussion = await discussionRepository.findOne({ _id: id, tenantId: actor.tenantId });
    if (!discussion) {
      throw notFound('Discussion not found', ERROR_CODES.NOT_FOUND);
    }
    return discussion;
  }

  private async requireParent(actor: AuthActor, scope: Scope, parentId?: string) {
    if (!parentId) {
      return undefined;
    }
    if (!discussionRepository.isObjectIdString(parentId)) {
      throw new AppError('Invalid parentId', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const parent = await discussionRepository.findOne({
      _id: parentId,
      tenantId: actor.tenantId,
    });
    if (!parent) {
      throw notFound('Parent discussion not found', ERROR_CODES.NOT_FOUND);
    }

    if (scope.kind === 'video') {
      if (String(parent.videoId ?? '') !== String(scope.id)) {
        throw new AppError('Parent must belong to the same video', ERROR_CODES.VALIDATION_ERROR, 400);
      }
    } else if (String(parent.lessonId ?? '') !== String(scope.id)) {
      throw new AppError('Parent must belong to the same lesson', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (parent.parentId) {
      throw new AppError('Replies cannot be nested further', ERROR_CODES.VALIDATION_ERROR, 400);
    }
    return parent;
  }

  private authorId(discussion: { createdBy: unknown }) {
    const raw = discussion.createdBy;
    if (typeof raw === 'object' && raw !== null && '_id' in raw) {
      return String((raw as { _id: unknown })._id);
    }
    return String(raw);
  }
}
