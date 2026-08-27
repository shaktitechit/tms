import { buildStorageKeys } from '@video/shared';
import type { AppContext } from '../../types.js';
import { mongoRegistry } from '../../data/mongoRegistry.js';

/**
 * Deletes all lesson-scoped content, seen rows, and storage prefixes for a lesson.
 */
export async function cascadeDeleteLessonContent(
  ctx: AppContext,
  lessonId: string,
  tenantId: string,
) {
  const lessonFilter = { lessonId, tenantId };

  const [textAreas, audios, images, quizzes, pdfs, videos] = await Promise.all([
    mongoRegistry.models.TextArea.find(lessonFilter).select('_id').lean(),
    mongoRegistry.models.Audio.find(lessonFilter).select('_id').lean(),
    mongoRegistry.models.Image.find(lessonFilter).select('_id').lean(),
    mongoRegistry.models.Quiz.find(lessonFilter).select('_id').lean(),
    mongoRegistry.models.Pdf.find(lessonFilter).select('_id').lean(),
    mongoRegistry.models.Video.find(lessonFilter).select('_id').lean(),
  ]);

  const textAreaIds = textAreas.map((row) => row._id);
  const audioIds = audios.map((row) => row._id);
  const imageIds = images.map((row) => row._id);
  const quizIds = quizzes.map((row) => row._id);
  const pdfIds = pdfs.map((row) => row._id);
  const videoIds = videos.map((row) => row._id);

  await Promise.all([
    textAreaIds.length
      ? mongoRegistry.models.TextAreaSeen.deleteMany({ textAreaId: { $in: textAreaIds } })
      : Promise.resolve(),
    audioIds.length
      ? mongoRegistry.models.AudioSeen.deleteMany({ audioId: { $in: audioIds } })
      : Promise.resolve(),
    imageIds.length
      ? mongoRegistry.models.ImageSeen.deleteMany({ imageId: { $in: imageIds } })
      : Promise.resolve(),
    quizIds.length
      ? mongoRegistry.models.QuizSeen.deleteMany({ quizId: { $in: quizIds } })
      : Promise.resolve(),
    pdfIds.length
      ? mongoRegistry.models.PdfSeen.deleteMany({ pdfId: { $in: pdfIds } })
      : Promise.resolve(),
    videoIds.length
      ? mongoRegistry.models.VideoSeen.deleteMany({ videoId: { $in: videoIds } })
      : Promise.resolve(),
    videoIds.length
      ? mongoRegistry.models.Discussion.deleteMany({ videoId: { $in: videoIds } })
      : Promise.resolve(),
    mongoRegistry.models.Discussion.deleteMany({ lessonId, tenantId }),
  ]);

  for (const audio of audios) {
    await ctx.storage.deletePrefix(`audios/${String(audio._id)}/`);
  }
  for (const image of images) {
    await ctx.storage.deletePrefix(`images/${String(image._id)}/`);
  }
  for (const pdf of pdfs) {
    await ctx.storage.deletePrefix(`pdfs/${String(pdf._id)}/`);
  }
  for (const video of videos) {
    const keys = buildStorageKeys(String(video._id));
    await ctx.storage.deletePrefix(keys.prefix);
  }

  await Promise.all([
    mongoRegistry.models.TextArea.deleteMany(lessonFilter),
    mongoRegistry.models.Audio.deleteMany(lessonFilter),
    mongoRegistry.models.Image.deleteMany(lessonFilter),
    mongoRegistry.models.Quiz.deleteMany(lessonFilter),
    mongoRegistry.models.Pdf.deleteMany(lessonFilter),
    mongoRegistry.models.Video.deleteMany(lessonFilter),
  ]);
}
