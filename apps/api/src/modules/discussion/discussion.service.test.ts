import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '@video/shared';
import mongoose from 'mongoose';
import { DiscussionService } from './discussion.service.js';

const findByRef = vi.fn();
const findLessonByRef = vi.fn();
const find = vi.fn();
const findOne = vi.fn();
const create = vi.fn();
const updateById = vi.fn();
const deleteThread = vi.fn();

vi.mock('../video/video.repository.js', () => ({
  videoRepository: {
    findByRef: (...args: unknown[]) => findByRef(...args),
  },
}));

vi.mock('../lesson/lesson.repository.js', () => ({
  lessonRepository: {
    findByRef: (...args: unknown[]) => findLessonByRef(...args),
  },
}));

vi.mock('./discussion.repository.js', () => ({
  discussionRepository: {
    isObjectIdString: (value: string) =>
      mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === value,
    find: (...args: unknown[]) => find(...args),
    findOne: (...args: unknown[]) => findOne(...args),
    create: (...args: unknown[]) => create(...args),
    updateById: (...args: unknown[]) => updateById(...args),
    deleteThread: (...args: unknown[]) => deleteThread(...args),
  },
}));

function actor(overrides: Partial<{ id: string; role: string; tenantId: string }> = {}) {
  return {
    id: new mongoose.Types.ObjectId().toHexString(),
    role: 'user',
    tenantId: new mongoose.Types.ObjectId().toHexString(),
    ...overrides,
  };
}

function videoDoc(tenantId: string) {
  return {
    _id: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(tenantId),
  };
}

function lessonDoc(tenantId: string) {
  return {
    _id: new mongoose.Types.ObjectId(),
    tenantId: new mongoose.Types.ObjectId(tenantId),
  };
}

describe('DiscussionService', () => {
  const service = new DiscussionService();

  beforeEach(() => {
    findByRef.mockReset();
    findLessonByRef.mockReset();
    find.mockReset();
    findOne.mockReset();
    create.mockReset();
    updateById.mockReset();
    deleteThread.mockReset();
  });

  it('requires videoId or lessonId when listing', async () => {
    await expect(service.list(actor(), {})).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      statusCode: 400,
    });
  });

  it('lists discussions for a tenant video', async () => {
    const member = actor();
    const video = videoDoc(member.tenantId);
    findByRef.mockResolvedValue(video);
    find.mockResolvedValue([]);

    await expect(service.list(member, { videoId: String(video._id) })).resolves.toEqual([]);
    expect(findByRef).toHaveBeenCalledWith(String(video._id), member.tenantId);
    expect(find).toHaveBeenCalledWith({
      tenantId: member.tenantId,
      videoId: video._id,
    });
  });

  it('lists discussions for a tenant lesson', async () => {
    const member = actor();
    const lesson = lessonDoc(member.tenantId);
    findLessonByRef.mockResolvedValue(lesson);
    find.mockResolvedValue([]);

    await expect(service.list(member, { lessonId: String(lesson._id) })).resolves.toEqual([]);
    expect(findLessonByRef).toHaveBeenCalledWith(String(lesson._id), member.tenantId);
    expect(find).toHaveBeenCalledWith({
      tenantId: member.tenantId,
      lessonId: lesson._id,
    });
  });

  it('hides videos from other tenants', async () => {
    findByRef.mockResolvedValue(null);
    await expect(service.list(actor(), { videoId: 'missing' })).rejects.toMatchObject({
      code: ERROR_CODES.VIDEO_NOT_FOUND,
      statusCode: 404,
    });
  });

  it('creates a top-level discussion on a tenant video', async () => {
    const member = actor();
    const video = videoDoc(member.tenantId);
    findByRef.mockResolvedValue(video);

    const createdId = new mongoose.Types.ObjectId();
    create.mockResolvedValue({
      _id: createdId,
      body: 'Nice clip',
      videoId: video._id,
      tenantId: new mongoose.Types.ObjectId(member.tenantId),
      createdBy: new mongoose.Types.ObjectId(member.id),
      parentId: undefined,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      async populate() {
        this.createdBy = { _id: new mongoose.Types.ObjectId(member.id), name: 'Ada', username: 'ada' };
        return this;
      },
    });

    const result = await service.create(member, { videoId: String(video._id), body: ' Nice clip ' });
    expect(result.body).toBe('Nice clip');
    expect(result.videoId).toBe(String(video._id));
    expect(result.lessonId).toBeNull();
    expect(result.parentId).toBeNull();
    expect(result.authorName).toBe('Ada');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Nice clip',
        videoId: video._id,
      }),
    );
  });

  it('creates a top-level discussion on a tenant lesson', async () => {
    const member = actor();
    const lesson = lessonDoc(member.tenantId);
    findLessonByRef.mockResolvedValue(lesson);

    create.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      body: 'Lesson note',
      lessonId: lesson._id,
      tenantId: new mongoose.Types.ObjectId(member.tenantId),
      createdBy: new mongoose.Types.ObjectId(member.id),
      parentId: undefined,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      async populate() {
        this.createdBy = { _id: new mongoose.Types.ObjectId(member.id), name: 'Ada', username: 'ada' };
        return this;
      },
    });

    const result = await service.create(member, {
      lessonId: String(lesson._id),
      body: ' Lesson note ',
    });
    expect(result.body).toBe('Lesson note');
    expect(result.lessonId).toBe(String(lesson._id));
    expect(result.videoId).toBeNull();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'Lesson note',
        lessonId: lesson._id,
      }),
    );
  });

  it('rejects replies nested more than one level', async () => {
    const member = actor();
    const video = videoDoc(member.tenantId);
    const parentId = new mongoose.Types.ObjectId();
    findByRef.mockResolvedValue(video);
    findOne.mockResolvedValue({
      _id: parentId,
      videoId: video._id,
      parentId: new mongoose.Types.ObjectId(),
    });

    await expect(
      service.create(member, {
        videoId: String(video._id),
        body: 'nested',
        parentId: String(parentId),
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      statusCode: 400,
    });
  });

  it('prevents non-authors from editing', async () => {
    const member = actor();
    const discussionId = new mongoose.Types.ObjectId();
    findOne.mockResolvedValue({
      _id: discussionId,
      createdBy: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(member.tenantId),
    });

    await expect(
      service.update(member, String(discussionId), { body: 'edited' }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.FORBIDDEN,
      statusCode: 403,
    });
  });

  it('lets a tenant admin delete another member discussion', async () => {
    const tenantId = new mongoose.Types.ObjectId().toHexString();
    const admin = actor({ role: 'tenant', tenantId });
    const discussionId = new mongoose.Types.ObjectId();
    findOne.mockResolvedValue({
      _id: discussionId,
      createdBy: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });
    deleteThread.mockResolvedValue({ deletedCount: 2 });

    await expect(service.remove(admin, String(discussionId))).resolves.toEqual({ deleted: true });
    expect(deleteThread).toHaveBeenCalledWith(String(discussionId), tenantId);
  });

  it('prevents members from deleting someone else discussion', async () => {
    const member = actor();
    const discussionId = new mongoose.Types.ObjectId();
    findOne.mockResolvedValue({
      _id: discussionId,
      createdBy: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(member.tenantId),
    });

    await expect(service.remove(member, String(discussionId))).rejects.toMatchObject({
      code: ERROR_CODES.FORBIDDEN,
      statusCode: 403,
    });
  });
});
