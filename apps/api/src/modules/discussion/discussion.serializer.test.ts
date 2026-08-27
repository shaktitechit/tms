import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import type { DiscussionDocument } from '../../models/index.js';
import { serializeDiscussion } from './discussion.serializer.js';

describe('serializeDiscussion', () => {
  it('exposes ids and a null parent for top-level comments', () => {
    const createdBy = new mongoose.Types.ObjectId();
    const discussion = {
      _id: new mongoose.Types.ObjectId('66c9e8abc1234567890abcde'),
      body: 'Great lesson',
      videoId: new mongoose.Types.ObjectId('66c9e8abc1234567890abcdf'),
      tenantId: new mongoose.Types.ObjectId(),
      createdBy,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as DiscussionDocument;

    expect(serializeDiscussion(discussion)).toMatchObject({
      id: '66c9e8abc1234567890abcde',
      body: 'Great lesson',
      videoId: '66c9e8abc1234567890abcdf',
      lessonId: null,
      parentId: null,
      createdBy: String(createdBy),
      authorName: null,
      authorUsername: null,
    });
  });

  it('includes populated author fields', () => {
    const authorId = new mongoose.Types.ObjectId();
    const discussion = {
      _id: new mongoose.Types.ObjectId(),
      body: 'Reply',
      videoId: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      parentId: new mongoose.Types.ObjectId('66c9e8abc1234567890abcde'),
      createdBy: { _id: authorId, name: 'Ada', username: 'ada' },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as DiscussionDocument;

    expect(serializeDiscussion(discussion)).toMatchObject({
      parentId: '66c9e8abc1234567890abcde',
      createdBy: String(authorId),
      authorName: 'Ada',
      authorUsername: 'ada',
    });
  });
});
