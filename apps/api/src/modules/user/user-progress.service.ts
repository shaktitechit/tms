import mongoose from 'mongoose';
import { ContentSeenStatus, VideoSeenStatus } from '@video/shared';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import { serializeAudio } from '../audio/audio.serializer.js';
import { audioSeenRepository } from '../audio/audio-seen.repository.js';
import { serializeDepartment } from '../department/department.serializer.js';
import { serializeImage } from '../image/image.serializer.js';
import { imageSeenRepository } from '../image/image-seen.repository.js';
import { serializeContentOrder } from '../content/lesson-content-order.js';
import { serializeLesson } from '../lesson/lesson.serializer.js';
import { quizDurationSeconds, summarizeLessonsForActor } from '../lesson/lesson-content-summary.js';
import { serializeModule } from '../module/module.serializer.js';
import { serializePdf } from '../pdf/pdf.serializer.js';
import { pdfSeenRepository } from '../pdf/pdf-seen.repository.js';
import { serializeQuiz, serializeQuizResult } from '../quiz/quiz.serializer.js';
import { quizSeenRepository } from '../quiz/quiz-seen.repository.js';
import { serializeTextArea } from '../text-area/text-area.serializer.js';
import { textAreaSeenRepository } from '../text-area/text-area-seen.repository.js';
import { serializeVideo } from '../video/video.serializer.js';
import { videoSeenRepository } from '../video/video-seen.repository.js';
import type { AllowedModuleSummary } from './user.serializer.js';

type SerializedMember = {
  id: string;
  departmentIds: string[];
  departments: Array<{ id: string; name: string; slug: string | null }>;
  moduleIds: string[];
  modules: AllowedModuleSummary[];
};

type CurriculumActor = {
  id: string;
  tenantId: string;
};

type CurriculumScope = {
  departmentIds?: string[];
  moduleIds?: string[];
};

function scopedObjectIds(ids: string[] | undefined): mongoose.Types.ObjectId[] | null {
  if (ids === undefined) {
    return null;
  }
  return ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

function completedSet(
  rows: Array<Record<string, unknown>>,
  idField: string,
): Set<string> {
  return new Set(rows.map((row) => String(row[idField])));
}

function seenExtra(completed: Set<string>, id: string) {
  return {
    seenStatus: completed.has(id) ? ContentSeenStatus.COMPLETED : ContentSeenStatus.PENDING,
  };
}

function withLessonModule(
  item: { lessonId: string | null },
  lessonsById: Map<string, { moduleId: string | null; moduleName: string | null }>,
) {
  const lesson = item.lessonId ? lessonsById.get(item.lessonId) : undefined;
  return {
    moduleId: lesson?.moduleId ?? null,
    moduleName: lesson?.moduleName ?? null,
  };
}

function contentIdsFromOrder(
  lessons: Array<{ contentOrder?: Array<{ kind?: string; contentId?: unknown }> }>,
  kind: string,
) {
  return lessons.flatMap((lesson) =>
    (lesson.contentOrder ?? [])
      .filter((entry) => entry.kind === kind && entry.contentId)
      .map((entry) =>
        entry.contentId instanceof mongoose.Types.ObjectId
          ? entry.contentId
          : new mongoose.Types.ObjectId(String(entry.contentId)),
      ),
  );
}

function lessonContentFilter(
  tenantId: string,
  lessonIds: mongoose.Types.ObjectId[],
  extraIds: mongoose.Types.ObjectId[],
) {
  if (extraIds.length === 0) {
    return { tenantId, lessonId: { $in: lessonIds } };
  }
  return {
    tenantId,
    $or: [{ lessonId: { $in: lessonIds } }, { _id: { $in: extraIds } }],
  };
}

function groupByLessonId<T extends { lessonId: string | null }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!item.lessonId) {
      continue;
    }
    const list = map.get(item.lessonId) ?? [];
    list.push(item);
    map.set(item.lessonId, list);
  }
  return map;
}

export async function buildMemberProgress(tenantId: string, member: SerializedMember) {
  const assignedDepartmentIds = new Set(member.departmentIds);
  const assignedModules = member.modules.filter(
    (mod) => mod.departmentId && assignedDepartmentIds.has(mod.departmentId),
  );
  return buildCurriculum(tenantId, { id: member.id, tenantId }, {
    departmentIds: member.departmentIds,
    moduleIds: assignedModules.map((mod) => mod.id),
  });
}

export async function buildCurriculum(
  tenantId: string,
  actor: CurriculumActor,
  scope?: CurriculumScope,
) {
  const departmentObjectIds = scopedObjectIds(scope?.departmentIds);
  const moduleObjectIds = scopedObjectIds(scope?.moduleIds);

  const [departmentDocs, moduleDocs] = await Promise.all([
    departmentObjectIds === null
      ? mongoRegistry.models.Department.find({ tenantId }).sort({ name: 1 })
      : departmentObjectIds.length
        ? mongoRegistry.models.Department.find({
            _id: { $in: departmentObjectIds },
            tenantId,
          }).sort({ name: 1 })
        : Promise.resolve([]),
    moduleObjectIds === null
      ? mongoRegistry.models.Module.find({ tenantId })
          .populate('departmentId', 'name slug')
          .sort({ name: 1 })
      : moduleObjectIds.length
        ? mongoRegistry.models.Module.find({
            _id: { $in: moduleObjectIds },
            tenantId,
          })
            .populate('departmentId', 'name slug')
            .sort({ name: 1 })
        : Promise.resolve([]),
  ]);

  const lessonModuleIds = moduleDocs.map((mod) => mod._id);
  const lessons =
    lessonModuleIds.length > 0
      ? await mongoRegistry.models.Lesson.find({
          tenantId,
          moduleId: { $in: lessonModuleIds },
        })
          .populate('moduleId', 'name slug')
          .sort({ serial: 1, createdAt: 1 })
      : [];

  const summaries = await summarizeLessonsForActor(
    { id: actor.id, tenantId },
    lessons.map((lesson) => lesson._id),
  );

  const serializedLessons = lessons.map((lesson) => {
    const summary = summaries.get(String(lesson._id));
    return serializeLesson(lesson, {
      duration: summary?.duration ?? 0,
      completedPercent: summary?.completedPercent ?? 0,
      seenStatus: summary?.seenStatus ?? ContentSeenStatus.PENDING,
      contentOrder: serializeContentOrder(lesson.contentOrder),
    });
  });

  const lessonsByModule = new Map<string, typeof serializedLessons>();
  const lessonsById = new Map<
    string,
    { moduleId: string | null; moduleName: string | null }
  >();
  for (const lesson of serializedLessons) {
    if (lesson.moduleId) {
      const list = lessonsByModule.get(lesson.moduleId) ?? [];
      list.push(lesson);
      lessonsByModule.set(lesson.moduleId, list);
    }
    lessonsById.set(lesson.id, {
      moduleId: lesson.moduleId,
      moduleName: lesson.moduleName,
    });
  }

  const modules = moduleDocs.map((mod) => {
    const serialized = serializeModule(mod);
    const moduleLessons = lessonsByModule.get(serialized.id) ?? [];
    return {
      ...serialized,
      lessonCount: moduleLessons.length,
      lessons: moduleLessons,
    };
  });

  const moduleCountByDepartment = new Map<string, number>();
  for (const mod of modules) {
    if (!mod.departmentId) {
      continue;
    }
    moduleCountByDepartment.set(
      mod.departmentId,
      (moduleCountByDepartment.get(mod.departmentId) ?? 0) + 1,
    );
  }

  const departments = departmentDocs.map((department) =>
    serializeDepartment(department, {
      moduleCount: moduleCountByDepartment.get(String(department._id)) ?? 0,
    }),
  );

  const lessonIds = lessons.map((lesson) => lesson._id);
  const empty = lessonIds.length === 0;

  const [videos, audios, images, pdfs, textAreas, quizzes] = empty
    ? [[], [], [], [], [], []]
    : await Promise.all([
        mongoRegistry.models.Video.find(
          lessonContentFilter(tenantId, lessonIds, contentIdsFromOrder(lessons, 'video')),
        )
          .populate({
            path: 'moduleId',
            select: 'name slug departmentId',
            populate: { path: 'departmentId', select: 'name slug' },
          })
          .populate('lessonId', 'name slug')
          .sort({ createdAt: 1 }),
        mongoRegistry.models.Audio.find(
          lessonContentFilter(tenantId, lessonIds, contentIdsFromOrder(lessons, 'audio')),
        )
          .populate('lessonId', 'name slug')
          .sort({ createdAt: 1 }),
        mongoRegistry.models.Image.find(
          lessonContentFilter(tenantId, lessonIds, contentIdsFromOrder(lessons, 'image')),
        )
          .populate('lessonId', 'name slug')
          .sort({ createdAt: 1 }),
        mongoRegistry.models.Pdf.find(
          lessonContentFilter(tenantId, lessonIds, contentIdsFromOrder(lessons, 'pdf')),
        )
          .populate('lessonId', 'name slug')
          .sort({ createdAt: 1 }),
        mongoRegistry.models.TextArea.find(
          lessonContentFilter(tenantId, lessonIds, contentIdsFromOrder(lessons, 'text')),
        )
          .populate('lessonId', 'name slug')
          .sort({ createdAt: 1 }),
        mongoRegistry.models.Quiz.find(
          lessonContentFilter(tenantId, lessonIds, contentIdsFromOrder(lessons, 'quiz')),
        )
          .populate('lessonId', 'name slug')
          .sort({ createdAt: 1 }),
      ]);

  const [
    completedVideos,
    completedAudios,
    completedImages,
    completedPdfs,
    completedText,
    quizSeen,
  ] = await Promise.all([
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
    textAreaSeenRepository.findCompletedByUserAndIds(
      actor.id,
      textAreas.map((item) => item._id),
    ),
    quizSeenRepository.findByUserAndIds(
      actor.id,
      quizzes.map((item) => item._id),
    ),
  ]);

  const videoDone = completedSet(completedVideos as Array<Record<string, unknown>>, 'videoId');
  const audioDone = completedSet(completedAudios as Array<Record<string, unknown>>, 'audioId');
  const imageDone = completedSet(completedImages as Array<Record<string, unknown>>, 'imageId');
  const pdfDone = completedSet(completedPdfs as Array<Record<string, unknown>>, 'pdfId');
  const textDone = completedSet(completedText as Array<Record<string, unknown>>, 'textAreaId');
  const quizById = new Map(quizSeen.map((row) => [String(row.quizId), row]));

  const serializedVideos = videos.map((item) =>
    serializeVideo(item, {
      seenStatus: videoDone.has(String(item._id))
        ? VideoSeenStatus.COMPLETED
        : VideoSeenStatus.PENDING,
    }),
  );
  const serializedAudios = audios.map((item) => {
    const dto = serializeAudio(item, seenExtra(audioDone, String(item._id)));
    return { ...dto, ...withLessonModule(dto, lessonsById) };
  });
  const serializedImages = images.map((item) => {
    const dto = serializeImage(item, seenExtra(imageDone, String(item._id)));
    return { ...dto, ...withLessonModule(dto, lessonsById) };
  });
  const serializedPdfs = pdfs.map((item) => {
    const dto = serializePdf(item, seenExtra(pdfDone, String(item._id)));
    return { ...dto, ...withLessonModule(dto, lessonsById) };
  });
  const serializedTextAreas = textAreas.map((item) => {
    const dto = serializeTextArea(item, seenExtra(textDone, String(item._id)));
    return { ...dto, ...withLessonModule(dto, lessonsById) };
  });
  const serializedQuizzes = quizzes.map((item) => {
    const seen = quizById.get(String(item._id));
    const completed = Boolean(seen && seen.status === ContentSeenStatus.COMPLETED);
    const dto = serializeQuiz(item, {
      duration: quizDurationSeconds(item.questions),
      seenStatus: completed ? ContentSeenStatus.COMPLETED : ContentSeenStatus.PENDING,
      ...(completed && seen ? { result: serializeQuizResult(seen) } : {}),
    });
    return { ...dto, ...withLessonModule(dto, lessonsById) };
  });

  const videosByLesson = groupByLessonId(serializedVideos);
  const audiosByLesson = groupByLessonId(serializedAudios);
  const imagesByLesson = groupByLessonId(serializedImages);
  const pdfsByLesson = groupByLessonId(serializedPdfs);
  const textAreasByLesson = groupByLessonId(serializedTextAreas);
  const quizzesByLesson = groupByLessonId(serializedQuizzes);

  const modulesWithContent = modules.map((mod) => ({
    ...mod,
    lessons: (mod.lessons ?? []).map((lesson) => ({
      ...lesson,
      videos: videosByLesson.get(lesson.id) ?? [],
      audios: audiosByLesson.get(lesson.id) ?? [],
      images: imagesByLesson.get(lesson.id) ?? [],
      pdfs: pdfsByLesson.get(lesson.id) ?? [],
      textAreas: textAreasByLesson.get(lesson.id) ?? [],
      quizzes: quizzesByLesson.get(lesson.id) ?? [],
    })),
  }));

  return {
    departments,
    modules: modulesWithContent,
    videos: serializedVideos,
    audios: serializedAudios,
    images: serializedImages,
    pdfs: serializedPdfs,
    textAreas: serializedTextAreas,
    quizzes: serializedQuizzes,
  };
}
