'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { inputClassName, primaryButtonClassName } from '@/components/portals';
import { useToast } from '@/components/Toaster';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { useCanManageCurriculum } from '@/lib/learner-preview';
import type { DiscussionDto } from '@/lib/types';
import {
  getErrorMessage,
  useCreateDiscussionMutation,
  useDeleteDiscussionMutation,
  useListDiscussionsQuery,
  useUpdateDiscussionMutation,
} from '@/store/api';

type VideoDiscussionProps =
  | { videoId: string; lessonId?: never; placeholder?: string }
  | { lessonId: string; videoId?: never; placeholder?: string };

export function VideoDiscussion(props: VideoDiscussionProps) {
  const videoId = 'videoId' in props ? props.videoId : undefined;
  const lessonId = 'lessonId' in props ? props.lessonId : undefined;
  const scopeId = videoId ?? lessonId ?? '';
  const placeholder =
    props.placeholder ??
    (videoId
      ? 'Share a question or note about this video'
      : 'Share a question or note about this lesson');

  const toast = useToast();
  const { user } = useAuth();
  const canManage = useCanManageCurriculum();
  const { data, error, isLoading } = useListDiscussionsQuery(
    { videoId, lessonId },
    { skip: !scopeId || !user },
  );
  const [createDiscussion, { isLoading: posting }] = useCreateDiscussionMutation();
  const [updateDiscussion, { isLoading: saving }] = useUpdateDiscussionMutation();
  const [deleteDiscussion, { isLoading: removing }] = useDeleteDiscussionMutation();

  const [draft, setDraft] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [pendingDelete, setPendingDelete] = useState<DiscussionDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const discussions = data?.discussions ?? [];
  const { roots, repliesByParent } = useMemo(() => threadDiscussions(discussions), [discussions]);

  function createBody(body: string, parentId?: string) {
    if (videoId) {
      return { videoId, body, parentId };
    }
    return { lessonId: lessonId!, body, parentId };
  }

  async function submitTopLevel(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !user) {
      return;
    }
    setActionError(null);
    try {
      await createDiscussion(createBody(body)).unwrap();
      setDraft('');
      toast.success('Comment posted.');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not post comment'));
    }
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    const body = replyDraft.trim();
    if (!body || !replyToId || !user) {
      return;
    }
    setActionError(null);
    try {
      await createDiscussion(createBody(body, replyToId)).unwrap();
      setReplyToId(null);
      setReplyDraft('');
      toast.success('Reply posted.');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not post reply'));
    }
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    const body = editDraft.trim();
    if (!body || !editingId) {
      return;
    }
    setActionError(null);
    try {
      await updateDiscussion({ id: editingId, body }).unwrap();
      setEditingId(null);
      setEditDraft('');
      toast.success('Comment updated.');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not update comment'));
    }
  }

  async function onDelete() {
    if (!pendingDelete) {
      return;
    }
    const id = pendingDelete.id;
    setActionError(null);
    try {
      await deleteDiscussion(id).unwrap();
      setPendingDelete(null);
      if (replyToId === id) {
        setReplyToId(null);
        setReplyDraft('');
      }
      if (editingId === id) {
        setEditingId(null);
        setEditDraft('');
      }
      toast.success('Comment deleted.');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not delete comment'));
    }
  }

  function startReply(item: DiscussionDto) {
    setEditingId(null);
    setReplyToId(item.id);
    setReplyDraft('');
  }

  function startEdit(item: DiscussionDto) {
    setReplyToId(null);
    setEditingId(item.id);
    setEditDraft(item.body);
  }

  const busy = posting || saving || removing;

  return (
    <section className="space-y-4 border-t border-blue-100 pt-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Discussion</h2>
        <p className="mt-1 text-sm text-slate-500">
          {isLoading
            ? 'Loading comments…'
            : `${discussions.length} ${discussions.length === 1 ? 'comment' : 'comments'}`}
        </p>
      </div>

      <form onSubmit={(event) => void submitTopLevel(event)} className="space-y-3">
        <label className="block text-sm text-slate-700">
          Add a comment
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={placeholder}
            className={`${inputClassName} mt-1.5 resize-y`}
          />
        </label>
        <div className="flex items-center gap-3">
          <span className="mr-auto text-xs text-slate-400">{draft.length}/2000</span>
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="shrink-0 rounded-full bg-accent px-3 py-1 text-sm font-medium text-white transition hover:bg-accent-dim disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>

      {error ? (
        <p className="text-rose-600">{getErrorMessage(error, 'Failed to load discussion')}</p>
      ) : null}
      {actionError ? <p className="text-rose-600">{actionError}</p> : null}

      {isLoading ? (
        <p className="text-slate-500">Loading comments…</p>
      ) : roots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-blue-100 bg-white p-6 text-center text-slate-500 sm:p-8">
          No comments yet. Start the discussion.
        </p>
      ) : (
        <ul className="space-y-4">
          {roots.map((item) => {
            const replies = repliesByParent.get(item.id) ?? [];
            return (
            <li key={item.id}>
              <CommentCard
                item={item}
                canEdit={user?.id === item.createdBy}
                canDelete={user?.id === item.createdBy || canManage}
                editing={editingId === item.id}
                editDraft={editDraft}
                onEditDraft={setEditDraft}
                onStartEdit={() => startEdit(item)}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={(event) => void submitEdit(event)}
                onDelete={() => {
                  setActionError(null);
                  setPendingDelete(item);
                }}
                onReply={() => startReply(item)}
                showReply={replyToId === item.id}
                replyDraft={replyDraft}
                onReplyDraft={setReplyDraft}
                onCancelReply={() => setReplyToId(null)}
                onSubmitReply={(event) => void submitReply(event)}
                busy={busy}
              />
              {replies.length > 0 ? (
                <ul className="mt-3 space-y-3 border-l border-blue-100 pl-3 sm:pl-6">
                  {replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentCard
                        item={reply}
                        canEdit={user?.id === reply.createdBy}
                        canDelete={user?.id === reply.createdBy || canManage}
                        editing={editingId === reply.id}
                        editDraft={editDraft}
                        onEditDraft={setEditDraft}
                        onStartEdit={() => startEdit(reply)}
                        onCancelEdit={() => setEditingId(null)}
                        onSaveEdit={(event) => void submitEdit(event)}
                        onDelete={() => {
                          setActionError(null);
                          setPendingDelete(reply);
                        }}
                        busy={busy}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
            );
          })}
        </ul>
      )}

      {pendingDelete ? (
        <ConfirmDeleteModal
          title="Delete comment"
          description="Delete this comment? Replies to it will remain. This cannot be undone."
          confirming={removing}
          error={actionError}
          onConfirm={() => void onDelete()}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </section>
  );
}

function threadDiscussions(discussions: DiscussionDto[]) {
  const roots: DiscussionDto[] = [];
  const repliesByParent = new Map<string, DiscussionDto[]>();
  for (const item of discussions) {
    if (!item.parentId) {
      roots.push(item);
      continue;
    }
    const replies = repliesByParent.get(item.parentId) ?? [];
    replies.push(item);
    repliesByParent.set(item.parentId, replies);
  }
  return { roots, repliesByParent };
}

function authorLabel(item: DiscussionDto) {
  return item.authorName?.trim() || item.authorUsername?.trim() || 'Member';
}

function authorInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

function CommentCard({
  item,
  canEdit,
  canDelete,
  editing,
  editDraft,
  onEditDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReply,
  showReply,
  replyDraft,
  onReplyDraft,
  onCancelReply,
  onSubmitReply,
  busy,
}: {
  item: DiscussionDto;
  canEdit: boolean;
  canDelete: boolean;
  editing: boolean;
  editDraft: string;
  onEditDraft: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (event: FormEvent) => void;
  onDelete: () => void;
  onReply?: () => void;
  showReply?: boolean;
  replyDraft?: string;
  onReplyDraft?: (value: string) => void;
  onCancelReply?: () => void;
  onSubmitReply?: (event: FormEvent) => void;
  busy: boolean;
}) {
  const name = authorLabel(item);

  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-accent"
        >
          {authorInitials(name)}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="font-medium text-slate-900">{name}</p>
            {item.authorUsername ? (
              <p className="text-xs text-slate-500">@{item.authorUsername}</p>
            ) : null}
            <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
          </div>

          {editing ? (
            <form onSubmit={onSaveEdit} className="space-y-2">
              <textarea
                value={editDraft}
                onChange={(event) => onEditDraft(event.target.value)}
                maxLength={2000}
                rows={3}
                className={`${inputClassName} resize-y`}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy || !editDraft.trim()}
                  className={`${primaryButtonClassName} w-auto px-4 py-1.5 text-sm`}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="rounded-full border border-blue-100 px-4 py-1.5 text-sm text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.body}</p>
          )}

          {!editing ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {onReply ? (
                <button
                  type="button"
                  onClick={onReply}
                  className="text-xs text-slate-500 hover:text-accent"
                >
                  Reply
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={onStartEdit}
                  className="text-xs text-slate-500 hover:text-accent"
                >
                  Edit
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy}
                  className="text-xs text-rose-500 hover:text-rose-400 disabled:opacity-50"
                >
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}

          {showReply && onSubmitReply && onReplyDraft && onCancelReply ? (
            <form onSubmit={onSubmitReply} className="space-y-2 pt-2">
              <textarea
                value={replyDraft}
                onChange={(event) => onReplyDraft(event.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Write a reply"
                className={`${inputClassName} resize-y`}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy || !replyDraft?.trim()}
                  className={`${primaryButtonClassName} w-auto px-4 py-1.5 text-sm`}
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={onCancelReply}
                  className="rounded-full border border-blue-100 px-4 py-1.5 text-sm text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}
