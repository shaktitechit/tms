import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppError,
  ERROR_CODES,
  VideoSeenStatus,
  VideoSourceType,
  VideoStatus,
  VideoVisibility,
} from '@video/shared';
import mongoose from 'mongoose';
import type { AppContext } from '../../types.js';

const findByRef = vi.fn();
const deleteById = vi.fn();
const create = vi.fn();
const find = vi.fn();
const updateById = vi.fn();
const allocateSlug = vi.fn();
const removeJob = vi.fn();
const enqueue = vi.fn();
const deleteByVideoId = vi.fn();
const findSeen = vi.fn();
const upsertSeen = vi.fn();
const deleteSeenByVideoId = vi.fn();

vi.mock('./video.repository.js', () => ({
  videoRepository: {
    findByRef: (...args: unknown[]) => findByRef(...args),
    deleteById: (...args: unknown[]) => deleteById(...args),
    create: (...args: unknown[]) => create(...args),
    find: (...args: unknown[]) => find(...args),
    updateById: (...args: unknown[]) => updateById(...args),
    allocateSlug: (...args: unknown[]) => allocateSlug(...args),
  },
}));

vi.mock('@video/shared/server', async () => {
  const actual = await vi.importActual<typeof import('@video/shared/server')>('@video/shared/server');
  return {
    ...actual,
    enqueueVideoProcessing: (...args: unknown[]) => enqueue(...args),
    removeVideoProcessingJob: (...args: unknown[]) => removeJob(...args),
  };
});

vi.mock('../discussion/discussion.repository.js', () => ({
  discussionRepository: {
    deleteByVideoId: (...args: unknown[]) => deleteByVideoId(...args),
  },
}));

vi.mock('./video-seen.repository.js', () => ({
  videoSeenRepository: {
    findCompletedByUserAndVideoIds: (...args: unknown[]) => findSeen(...args),
    upsertCompleted: (...args: unknown[]) => upsertSeen(...args),
    deleteByVideoId: (...args: unknown[]) => deleteSeenByVideoId(...args),
  },
}));

import { VideoService } from './video.service.js';

function ctx(): AppContext {
  return {
    env: {
      ALLOWED_VIDEO_MIME_TYPES: 'video/mp4',
      ALLOWED_VIDEO_EXTENSIONS: '.mp4',
    } as AppContext['env'],
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } as unknown as AppContext['logger'],
    storage: {
      deletePrefix: vi.fn().mockResolvedValue(4),
      upload: vi.fn().mockResolvedValue(undefined),
    } as unknown as AppContext['storage'],
    queue: {} as AppContext['queue'],
    audioQueue: {} as AppContext['audioQueue'],
    sessionRecordingQueue: {} as AppContext['sessionRecordingQueue'],
  };
}

describe('VideoService authorization and deletion', () => {
  beforeEach(() => {
    findByRef.mockReset();
    deleteById.mockReset();
    find.mockReset();
    create.mockReset();
    enqueue.mockReset();
    removeJob.mockReset();
    allocateSlug.mockReset();
    deleteByVideoId.mockReset();
    deleteByVideoId.mockResolvedValue({ deletedCount: 0 });
    findSeen.mockReset();
    findSeen.mockResolvedValue([]);
    upsertSeen.mockReset();
    deleteSeenByVideoId.mockReset();
    deleteSeenByVideoId.mockResolvedValue({ deletedCount: 0 });
    allocateSlug.mockResolvedValue('clip');
  });

  it('returns status for an accessible video', async () => {
    const video = {
      _id: new mongoose.Types.ObjectId('66c9e8abc1234567890abcde'),
      title: 'Clip',
      slug: 'clip',
      description: '',
      originalFilename: 'clip.mp4',
      originalStorageKey: 'videos/66c9e8abc1234567890abcde/original/source.mp4',
      status: VideoStatus.PROCESSING,
      processingProgress: 65,
      fileSize: 10,
      mimeType: 'video/mp4',
      availableQualities: [],
      visibility: VideoVisibility.PUBLIC,
      createdBy: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    findByRef.mockResolvedValue(video);
    const service = new VideoService(ctx());
    await expect(service.getStatus(String(video._id))).resolves.toEqual({
      id: String(video._id),
      slug: 'clip',
      status: VideoStatus.PROCESSING,
      progress: 65,
      errorMessage: null,
    });
  });

  it('lists all tenant videos for a tenant admin', async () => {
    const tenantId = new mongoose.Types.ObjectId().toHexString();
    find.mockResolvedValue([]);
    const service = new VideoService(ctx());
    await service.listForTenant({ id: 'admin', role: 'tenant', tenantId }, { status: 'READY' });
    expect(find).toHaveBeenCalledWith({ tenantId, status: 'READY' });
  });

  it('lists all tenant videos for a member user', async () => {
    const tenantId = new mongoose.Types.ObjectId().toHexString();
    const userId = new mongoose.Types.ObjectId().toHexString();
    find.mockResolvedValue([]);
    const service = new VideoService(ctx());
    await service.listForUser({ id: userId, role: 'user', tenantId });
    expect(find).toHaveBeenCalledWith({ tenantId });
  });

  it('prevents non-owners from deleting via user scope', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    findByRef.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
      tenantId,
      visibility: VideoVisibility.PUBLIC,
    });
    const service = new VideoService(ctx());
    await expect(
      service.deleteForUser('66c9e8abc1234567890abcde', {
        id: 'someone-else',
        role: 'user',
        tenantId: String(tenantId),
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.FORBIDDEN, statusCode: 403 });
  });

  it('deletes storage objects, jobs, and the mongo record idempotently', async () => {
    const id = new mongoose.Types.ObjectId('66c9e8abc1234567890abcde');
    const tenantId = new mongoose.Types.ObjectId();
    findByRef.mockResolvedValueOnce({
      _id: id,
      createdBy: id,
      tenantId,
      visibility: VideoVisibility.PRIVATE,
    });
    deleteById.mockResolvedValue({});
    const context = ctx();
    const service = new VideoService(context);
    await expect(
      service.deleteForUser(String(id), {
        id: String(id),
        role: 'user',
        tenantId: String(tenantId),
      }),
    ).resolves.toEqual({
      deleted: true,
    });
    expect(removeJob).toHaveBeenCalled();
    expect(context.storage.deletePrefix).toHaveBeenCalledWith(`videos/${String(id)}`);
    expect(deleteByVideoId).toHaveBeenCalledWith(String(id));
    expect(deleteSeenByVideoId).toHaveBeenCalledWith(String(id));
    expect(deleteById).toHaveBeenCalledWith(String(id));

    findByRef.mockResolvedValueOnce(null);
    await expect(
      service.deleteForUser(String(id), {
        id: String(id),
        role: 'user',
        tenantId: String(tenantId),
      }),
    ).resolves.toEqual({
      deleted: true,
    });
  });

  it('marks queue failures as processing errors', async () => {
    const save = vi.fn();
    const created = {
      _id: new mongoose.Types.ObjectId('66c9e8abc1234567890abcde'),
      status: VideoStatus.UPLOADING,
      slug: 'clip',
      save,
    };
    create.mockResolvedValue(created);
    enqueue.mockRejectedValue(new Error('redis down'));
    const service = new VideoService(ctx());
    await expect(
      service.createFromUpload({
        userId: new mongoose.Types.ObjectId().toHexString(),
        tenantId: new mongoose.Types.ObjectId().toHexString(),
        title: 'Clip',
        description: '',
        visibility: VideoVisibility.PUBLIC,
        originalFilename: 'clip.mp4',
        mimeType: 'video/mp4',
        fileSize: 100,
        body: {} as never,
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(created.status).toBe(VideoStatus.FAILED);
  });

  it('defaults listed videos to pending seen status', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const video = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Clip',
      slug: 'clip',
      description: '',
      originalFilename: 'clip.mp4',
      originalStorageKey: 'videos/x/original/source.mp4',
      status: VideoStatus.READY,
      processingProgress: 100,
      fileSize: 10,
      mimeType: 'video/mp4',
      availableQualities: [],
      visibility: VideoVisibility.PUBLIC,
      createdBy: new mongoose.Types.ObjectId(),
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    find.mockResolvedValue([video]);
    findSeen.mockResolvedValue([]);
    const service = new VideoService(ctx());
    const [listed] = await service.listForTenant({
      id: new mongoose.Types.ObjectId().toHexString(),
      role: 'tenant',
      tenantId: String(tenantId),
    });
    expect(listed.seenStatus).toBe(VideoSeenStatus.PENDING);
  });

  it('marks a video completed for the current member', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const video = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Clip',
      slug: 'clip',
      description: '',
      originalFilename: 'clip.mp4',
      originalStorageKey: 'videos/x/original/source.mp4',
      status: VideoStatus.READY,
      processingProgress: 100,
      fileSize: 10,
      mimeType: 'video/mp4',
      availableQualities: [],
      visibility: VideoVisibility.PUBLIC,
      createdBy: userId,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    findByRef.mockResolvedValue(video);
    upsertSeen.mockResolvedValue({});
    const service = new VideoService(ctx());
    const result = await service.markSeenForUser(String(video._id), {
      id: String(userId),
      role: 'user',
      tenantId: String(tenantId),
    });
    expect(upsertSeen).toHaveBeenCalledWith({
      videoId: video._id,
      userId: String(userId),
      tenantId: String(tenantId),
    });
    expect(result.seenStatus).toBe(VideoSeenStatus.COMPLETED);
  });

  it('queues a YouTube video for processing', async () => {
    allocateSlug.mockResolvedValue('intro');
    enqueue.mockResolvedValue('job-id');
    create.mockImplementation(async (data) => ({
      ...data,
      save: vi.fn(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Intro from YouTube' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new VideoService(ctx());
    const result = await service.createFromYoutube({
      userId: new mongoose.Types.ObjectId().toHexString(),
      tenantId: new mongoose.Types.ObjectId().toHexString(),
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      description: 'Linked from YouTube',
      visibility: VideoVisibility.PUBLIC,
    });

    expect(result.status).toBe(VideoStatus.QUEUED);
    expect(result.sourceType).toBe(VideoSourceType.YOUTUBE);
    expect(result.youtubeVideoId).toBe('dQw4w9WgXcQ');
    expect(result.title).toBe('Intro from YouTube');
    expect(result.playbackUrl).toBeNull();
    expect(enqueue).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('rejects an invalid YouTube link', async () => {
    const service = new VideoService(ctx());
    await expect(
      service.createFromYoutube({
        userId: new mongoose.Types.ObjectId().toHexString(),
        tenantId: new mongoose.Types.ObjectId().toHexString(),
        youtubeUrl: 'https://vimeo.com/123',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  });
});
