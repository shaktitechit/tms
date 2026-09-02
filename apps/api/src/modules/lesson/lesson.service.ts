import mongoose, { type HydratedDocument } from 'mongoose';
import {
  ContentSeenStatus,
  ERROR_CODES,
  previousLessonsBlockAccess,
  VideoSeenStatus,
  withSequentialLocks,
} from '@video/shared';
import { assertCanManageCurriculum, canManageCurriculum, isLearnerActor } from '../../http/access.js';
import { forbidden, notFound, badRequest } from '../../http/errors.js';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { LessonDocument } from '../../models/index.js';
import type { AppContext } from '../../types.js';
import { cascadeDeleteLessonContent } from '../content/lesson-content.cascade.js';
import {
  contentOrderChanged,
  reconcileContentOrder,
  serializeContentOrder,
  setLessonContentOrder,
  type LessonContentKind,
  type LessonContentOrderItem,
} from '../content/lesson-content-order.js';
import { serializeAudio } from '../audio/audio.serializer.js';
import { audioSeenRepository } from '../audio/audio-seen.repository.js';
import { serializeImage } from '../image/image.serializer.js';
import { imageSeenRepository } from '../image/image-seen.repository.js';
import { serializePdf } from '../pdf/pdf.serializer.js';
import { pdfSeenRepository } from '../pdf/pdf-seen.repository.js';
import { serializeQuiz, serializeQuizResult } from '../quiz/quiz.serializer.js';
import { quizSeenRepository } from '../quiz/quiz-seen.repository.js';
import { serializeTextArea } from '../text-area/text-area.serializer.js';
import { textAreaSeenRepository } from '../text-area/text-area-seen.repository.js';
import { serializeVideo } from '../video/video.serializer.js';
import { videoSeenRepository } from '../video/video-seen.repository.js';
import { moduleRepository } from '../module/module.repository.js';
import type { ParsedLessonForm, ParsedLessonImage } from './lesson.form.parser.js';
import { thumbnailExtension } from './lesson.form.parser.js';
import {
  contentSummaryFromItems,
  numericDuration,
  quizDurationSeconds,
  summarizeLessonsForActor,
} from './lesson-content-summary.js';
import { serializeLesson } from './lesson.serializer.js';
import { lessonRepository } from './lesson.repository.js';

type AuthActor = {
  id: string;
  role: string;
  tenantId: string;
  access?: string | null;
  name?: string;
  email?: string;
};

type LessonEntity = HydratedDocument<LessonDocument>;

export class LessonService {
  constructor(private readonly ctx: AppContext) {}

  async list(actor: AuthActor, options?: { module?: string }) {
    let moduleId: string | undefined;
    if (options?.module) {
      moduleId = String(await this.resolveModuleId(actor.tenantId, options.module));
    }
    const lessons = await lessonRepository.findByTenant(actor.tenantId, moduleId);
    await this.ensureSerials(lessons);
    const summaries = await summarizeLessonsForActor(
      actor,
      lessons.map((lesson) => lesson._id),
    );
    const rows = await Promise.all(
      lessons.map(async (lesson) => {
        const base = await this.ensureAuthor(lesson);
        const summary = summaries.get(String(lesson._id));
        return {
          ...base,
          duration: summary?.duration ?? 0,
          completedPercent: summary?.completedPercent ?? 0,
          seenStatus: summary?.seenStatus ?? ContentSeenStatus.PENDING,
        };
      }),
    );
    return withSequentialLocks(rows, isLearnerActor(actor));
  }

  async getById(actor: AuthActor, ref: string) {
    const lesson = await this.requireLesson(actor, ref);
    await this.assertLearnerMayOpenLesson(actor, lesson);
    await lesson.populate('moduleId', 'name slug');
    const filter = { tenantId: actor.tenantId, lessonId: lesson._id };

    const [textAreas, videos, audios, images, quizzes, pdfs] = await Promise.all([
      mongoRegistry.models.TextArea.find(filter).sort({ createdAt: 1 }),
      mongoRegistry.models.Video.find(filter).sort({ createdAt: 1 }),
      mongoRegistry.models.Audio.find(filter).sort({ createdAt: 1 }),
      mongoRegistry.models.Image.find(filter).sort({ createdAt: 1 }),
      mongoRegistry.models.Quiz.find(filter).sort({ createdAt: 1 }),
      mongoRegistry.models.Pdf.find(filter).sort({ createdAt: 1 }),
    ]);

    const present = [
      ...textAreas.map((item) => ({
        kind: 'text' as const,
        id: String(item._id),
        createdAt: item.createdAt,
      })),
      ...videos.map((item) => ({
        kind: 'video' as const,
        id: String(item._id),
        createdAt: item.createdAt,
      })),
      ...audios.map((item) => ({
        kind: 'audio' as const,
        id: String(item._id),
        createdAt: item.createdAt,
      })),
      ...images.map((item) => ({
        kind: 'image' as const,
        id: String(item._id),
        createdAt: item.createdAt,
      })),
      ...quizzes.map((item) => ({
        kind: 'quiz' as const,
        id: String(item._id),
        createdAt: item.createdAt,
      })),
      ...pdfs.map((item) => ({
        kind: 'pdf' as const,
        id: String(item._id),
        createdAt: item.createdAt,
      })),
    ];

    const previousOrder = serializeContentOrder(
      lesson.contentOrder as { kind: LessonContentKind; contentId: mongoose.Types.ObjectId }[] | undefined,
    );
    const contentOrder = reconcileContentOrder(
      lesson.contentOrder as { kind: LessonContentKind; contentId: mongoose.Types.ObjectId }[] | undefined,
      present,
    );

    if (contentOrderChanged(previousOrder, contentOrder)) {
      lesson.contentOrder = contentOrder.map((item) => ({
        kind: item.kind,
        contentId: new mongoose.Types.ObjectId(item.id),
      })) as LessonDocument['contentOrder'];
      await lesson.save();
    }

    const base = await this.ensureAuthor(lesson);
    const [
      completedText,
      completedVideos,
      completedAudios,
      completedImages,
      completedPdfs,
      completedQuizzes,
    ] = await Promise.all([
      textAreaSeenRepository.findCompletedByUserAndIds(
        actor.id,
        textAreas.map((item) => item._id),
      ),
      videoSeenRepository.findCompletedByUserAndVideoIds(
        actor.id,
        videos.map((item) => item._id),
      ),
      audioSeenRepository.findCompletedByUserAndIds(
        actor.id,
        audios.map((item) => item._id),
      ),
      imageSeenRepository.findCompletedByUserAndIds(
        actor.id,
        images.map((item) => item._id),
      ),
      pdfSeenRepository.findCompletedByUserAndIds(
        actor.id,
        pdfs.map((item) => item._id),
      ),
      quizSeenRepository.findByUserAndIds(
        actor.id,
        quizzes.map((item) => item._id),
      ),
    ]);
    const completedTextIds = new Set(completedText.map((row) => String(row.textAreaId)));
    const completedVideoIds = new Set(completedVideos.map((row) => String(row.videoId)));
    const completedAudioIds = new Set(completedAudios.map((row) => String(row.audioId)));
    const completedImageIds = new Set(completedImages.map((row) => String(row.imageId)));
    const completedPdfIds = new Set(completedPdfs.map((row) => String(row.pdfId)));
    const quizSeenById = new Map(completedQuizzes.map((row) => [String(row.quizId), row]));
    const summary = contentSummaryFromItems([
      ...textAreas.map((item) => ({
        duration: numericDuration(item.duration),
        completed: completedTextIds.has(String(item._id)),
      })),
      ...videos.map((item) => ({
        duration: numericDuration(item.duration),
        completed: completedVideoIds.has(String(item._id)),
      })),
      ...audios.map((item) => ({
        duration: numericDuration(item.duration),
        completed: completedAudioIds.has(String(item._id)),
      })),
      ...images.map((item) => ({
        duration: numericDuration(item.duration),
        completed: completedImageIds.has(String(item._id)),
      })),
      ...quizzes.map((item) => ({
        duration: quizDurationSeconds(item.questions),
        completed: quizSeenById.get(String(item._id))?.status === ContentSeenStatus.COMPLETED,
      })),
      ...pdfs.map((item) => ({
        duration: numericDuration(item.duration),
        completed: completedPdfIds.has(String(item._id)),
      })),
    ]);

    return {
      ...base,
      duration: summary.duration,
      completedPercent: summary.completedPercent,
      seenStatus: summary.seenStatus,
      contentOrder,
      textAreas: textAreas.map((item) =>
        serializeTextArea(item, {
          seenStatus: completedTextIds.has(String(item._id))
            ? ContentSeenStatus.COMPLETED
            : ContentSeenStatus.PENDING,
        }),
      ),
      videos: videos.map((item) =>
        serializeVideo(item, {
          seenStatus: completedVideoIds.has(String(item._id))
            ? VideoSeenStatus.COMPLETED
            : VideoSeenStatus.PENDING,
        }),
      ),
      audios: audios.map((item) =>
        serializeAudio(item, {
          seenStatus: completedAudioIds.has(String(item._id))
            ? ContentSeenStatus.COMPLETED
            : ContentSeenStatus.PENDING,
        }),
      ),
      images: images.map((item) =>
        serializeImage(item, {
          seenStatus: completedImageIds.has(String(item._id))
            ? ContentSeenStatus.COMPLETED
            : ContentSeenStatus.PENDING,
        }),
      ),
      quizzes: quizzes.map((item) => {
        const seen = quizSeenById.get(String(item._id));
        if (!seen || seen.status !== ContentSeenStatus.COMPLETED) {
          return serializeQuiz(item);
        }
        return serializeQuiz(item, {
          seenStatus: ContentSeenStatus.COMPLETED,
          result: serializeQuizResult(seen),
        });
      }),
      pdfs: pdfs.map((item) =>
        serializePdf(item, {
          seenStatus: completedPdfIds.has(String(item._id))
            ? ContentSeenStatus.COMPLETED
            : ContentSeenStatus.PENDING,
        }),
      ),
      contentCounts: {
        textAreas: textAreas.length,
        videos: videos.length,
        audios: audios.length,
        images: images.length,
        quizzes: quizzes.length,
        pdfs: pdfs.length,
      },
    };
  }

  async reorderContent(actor: AuthActor, ref: string, items: LessonContentOrderItem[]) {
    assertCanManageCurriculum(actor);
    const lesson = await this.requireLesson(actor, ref);
    const contentOrder = await setLessonContentOrder(
      String(lesson._id),
      actor.tenantId,
      items,
    );
    return { contentOrder };
  }

  async reorder(actor: AuthActor, input: { moduleId: string; ids: string[] }) {
    assertCanManageCurriculum(actor);
    const moduleId = await this.resolveModuleId(actor.tenantId, input.moduleId);
    const lessons = await lessonRepository.findByTenant(actor.tenantId, String(moduleId));
    const byId = new Map(lessons.map((lesson) => [String(lesson._id), lesson]));
    if (
      input.ids.length !== lessons.length ||
      new Set(input.ids).size !== input.ids.length ||
      input.ids.some((id) => !byId.has(id))
    ) {
      throw badRequest('Lesson order must include every lesson in the module');
    }

    await Promise.all(
      input.ids.map((id, index) =>
        lessonRepository.updateById(id, actor.tenantId, { serial: index + 1 }),
      ),
    );

    return this.list(actor, { module: String(moduleId) });
  }

  async create(
    actor: AuthActor,
    input: {
      name: string;
      description?: string;
      authorName: string;
      authorEmail: string;
      moduleId: string;
    },
    thumbnail?: ParsedLessonImage,
  ) {
    assertCanManageCurriculum(actor);

    const lessonId = new mongoose.Types.ObjectId();
    const slug = await lessonRepository.allocateSlug(actor.tenantId, input.name.trim());
    const moduleId = await this.resolveModuleId(actor.tenantId, input.moduleId);
    let thumbnailStorageKey: string | undefined;

    if (thumbnail) {
      thumbnailStorageKey = await this.uploadThumbnail(String(lessonId), thumbnail);
    }

    const serial = await lessonRepository.allocateSerial(actor.tenantId, moduleId);
    const lesson = await lessonRepository.create({
      _id: lessonId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() ?? '',
      thumbnailStorageKey,
      authorName: input.authorName.trim(),
      authorEmail: input.authorEmail.trim().toLowerCase(),
      moduleId,
      serial,
      createdBy: new mongoose.Types.ObjectId(actor.id),
      tenantId: new mongoose.Types.ObjectId(actor.tenantId),
    });

    await lesson.populate('moduleId', 'name slug');
    return serializeLesson(lesson);
  }

  async createFromForm(actor: AuthActor, form: ParsedLessonForm) {
    return this.create(
      actor,
      {
        name: form.name,
        description: form.description,
        authorName: form.authorName,
        authorEmail: form.authorEmail,
        moduleId: form.moduleId,
      },
      form.thumbnail,
    );
  }

  async update(
    actor: AuthActor,
    ref: string,
    patch: {
      name?: string;
      description?: string;
      authorName?: string;
      authorEmail?: string;
      moduleId?: string;
    },
    thumbnail?: ParsedLessonImage,
  ) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireLesson(actor, ref);

    const updates: {
      name?: string;
      description?: string;
      authorName?: string;
      authorEmail?: string;
      thumbnailStorageKey?: string;
      moduleId?: mongoose.Types.ObjectId;
      serial?: number;
    } = {};
    if (patch.name !== undefined) {
      updates.name = patch.name.trim();
    }
    if (patch.description !== undefined) {
      updates.description = patch.description.trim();
    }
    if (patch.authorName !== undefined) {
      updates.authorName = patch.authorName.trim();
    }
    if (patch.authorEmail !== undefined) {
      updates.authorEmail = patch.authorEmail.trim().toLowerCase();
    }
    if (patch.moduleId !== undefined) {
      updates.moduleId = await this.resolveModuleId(actor.tenantId, patch.moduleId);
      if (String(updates.moduleId) !== this.moduleIdOf(existing)) {
        updates.serial = await lessonRepository.allocateSerial(actor.tenantId, updates.moduleId);
      }
    }
    if (thumbnail) {
      updates.thumbnailStorageKey = await this.uploadThumbnail(String(existing._id), thumbnail);
    }

    const updated = await lessonRepository.updateById(
      String(existing._id),
      actor.tenantId,
      updates as Partial<LessonDocument>,
    );
    if (!updated) {
      throw notFound('Lesson not found', ERROR_CODES.NOT_FOUND);
    }
    return serializeLesson(updated);
  }

  async updateFromForm(actor: AuthActor, ref: string, form: ParsedLessonForm) {
    return this.update(
      actor,
      ref,
      {
        name: form.name,
        description: form.description,
        authorName: form.authorName,
        authorEmail: form.authorEmail,
        moduleId: form.moduleId,
      },
      form.thumbnail,
    );
  }

  async remove(actor: AuthActor, ref: string) {
    assertCanManageCurriculum(actor);
    const existing = await this.requireLesson(actor, ref);
    const moduleId = this.moduleIdOf(existing);
    await cascadeDeleteLessonContent(this.ctx, String(existing._id), actor.tenantId);
    await this.ctx.storage.deletePrefix(`lessons/${String(existing._id)}/`);
    await lessonRepository.deleteById(String(existing._id), actor.tenantId);
    const remaining = await lessonRepository.findByTenant(
      actor.tenantId,
      moduleId ?? undefined,
    );
    await this.ensureSerials(remaining, true);
    return { deleted: true };
  }

  async pipeThumbnail(actor: AuthActor, ref: string, res: import('express').Response) {
    const lesson = await this.requireLesson(actor, ref);
    if (!lesson.thumbnailStorageKey) {
      throw notFound('Thumbnail not found', ERROR_CODES.NOT_FOUND);
    }

    const exists = await this.ctx.storage.exists(lesson.thumbnailStorageKey);
    if (!exists) {
      throw notFound('Thumbnail not found', ERROR_CODES.NOT_FOUND);
    }

    const metadata = await this.ctx.storage.getMetadata(lesson.thumbnailStorageKey);
    res.setHeader('Content-Type', metadata.contentType ?? 'image/jpeg');
    if (metadata.contentLength) {
      res.setHeader('Content-Length', String(metadata.contentLength));
    }
    res.setHeader('Cache-Control', 'private, max-age=86400');

    const body = await this.ctx.storage.download(lesson.thumbnailStorageKey);
    body.pipe(res);
  }

  private async uploadThumbnail(lessonId: string, file: ParsedLessonImage) {
    const key = `lessons/${lessonId}/thumbnail${thumbnailExtension(file.mimeType)}`;
    await this.ctx.storage.upload(key, file.stream, {
      contentType: file.mimeType,
      contentLength: file.size > 0 ? file.size : undefined,
    });
    return key;
  }

  private moduleIdOf(lesson: LessonEntity) {
    const raw = lesson.moduleId as unknown;
    if (!raw) {
      return null;
    }
    if (typeof raw === 'object' && raw !== null && '_id' in raw) {
      return String((raw as { _id: mongoose.Types.ObjectId })._id);
    }
    return String(raw);
  }

  private async ensureSerials(lessons: LessonEntity[], force = false) {
    const sorted = [...lessons].sort((a, b) => {
      const aSerial = typeof a.serial === 'number' && a.serial > 0 ? a.serial : Number.MAX_SAFE_INTEGER;
      const bSerial = typeof b.serial === 'number' && b.serial > 0 ? b.serial : Number.MAX_SAFE_INTEGER;
      if (aSerial !== bSerial) {
        return aSerial - bSerial;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const needsWrite =
      force || sorted.some((lesson, index) => lesson.serial !== index + 1);
    if (needsWrite) {
      await Promise.all(
        sorted.map((lesson, index) => {
          if (lesson.serial === index + 1) {
            return null;
          }
          lesson.serial = index + 1;
          return lesson.save();
        }),
      );
    }
    lessons.splice(0, lessons.length, ...sorted);
  }

  private async assertLearnerMayOpenLesson(actor: AuthActor, lesson: LessonEntity) {
    if (canManageCurriculum(actor)) {
      return;
    }
    const moduleId = this.moduleIdOf(lesson);
    if (!moduleId) {
      return;
    }
    const siblings = await lessonRepository.findByTenant(actor.tenantId, moduleId);
    await this.ensureSerials(siblings);
    const index = siblings.findIndex((item) => String(item._id) === String(lesson._id));
    if (index <= 0) {
      return;
    }
    const previous = siblings.slice(0, index);
    const summaries = await summarizeLessonsForActor(
      actor,
      previous.map((item) => item._id),
    );
    if (
      previousLessonsBlockAccess(
        previous.map((item) => ({
          seenStatus: summaries.get(String(item._id))?.seenStatus ?? ContentSeenStatus.PENDING,
        })),
      )
    ) {
      throw forbidden('Complete the previous lesson to unlock this one');
    }
  }

  private async requireLesson(actor: AuthActor, ref: string) {
    const lesson = await lessonRepository.findByRef(ref, actor.tenantId);
    if (!lesson) {
      throw notFound('Lesson not found', ERROR_CODES.NOT_FOUND);
    }
    if (!lesson.slug) {
      lesson.slug = await lessonRepository.allocateSlug(actor.tenantId, lesson.name);
      await lesson.save();
    }
    return lesson;
  }

  private async resolveModuleId(tenantId: string, moduleRef: string) {
    const ref = moduleRef.trim();
    if (!ref) {
      throw notFound('Module not found', ERROR_CODES.NOT_FOUND);
    }
    const mod = await moduleRepository.findByRef(ref, tenantId);
    if (!mod) {
      throw notFound('Module not found', ERROR_CODES.NOT_FOUND);
    }
    return mod._id;
  }

  private async ensureAuthor(lesson: LessonEntity) {
    if (lesson.authorName && lesson.authorEmail) {
      return serializeLesson(lesson);
    }

    if (lesson.createdBy) {
      const user = await mongoRegistry.models.User.findById(lesson.createdBy).lean();
      if (user) {
        lesson.authorName = user.name;
        lesson.authorEmail = user.email;
        await lesson.save();
      }
    }

    return serializeLesson({
      ...lesson.toObject(),
      authorName: lesson.authorName ?? 'Unknown',
      authorEmail: lesson.authorEmail ?? '',
    } as LessonDocument);
  }
}
