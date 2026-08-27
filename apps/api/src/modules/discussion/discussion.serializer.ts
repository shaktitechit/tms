import type { DiscussionDocument } from '../../models/index.js';
import type mongoose from 'mongoose';

type PopulatedAuthor = {
  _id: mongoose.Types.ObjectId;
  name: string;
  username: string;
};

function authorFields(discussion: DiscussionDocument) {
  const raw = discussion.createdBy as unknown;
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    const author = raw as PopulatedAuthor;
    return {
      createdBy: String(author._id),
      authorName: author.name,
      authorUsername: author.username,
    };
  }
  return {
    createdBy: String(raw),
    authorName: null as string | null,
    authorUsername: null as string | null,
  };
}

export function serializeDiscussion(discussion: DiscussionDocument) {
  return {
    id: String(discussion._id),
    body: discussion.body,
    videoId: discussion.videoId ? String(discussion.videoId) : null,
    lessonId: discussion.lessonId ? String(discussion.lessonId) : null,
    tenantId: String(discussion.tenantId),
    parentId: discussion.parentId ? String(discussion.parentId) : null,
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
    ...authorFields(discussion),
  };
}
