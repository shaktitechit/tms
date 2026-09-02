'use client';

import { useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { canHostLiveSession, dashboardHome, isTenantAdmin } from '@/lib/roles';
import type { TenantUserDto } from '@/lib/types';
import {
  useListLiveSessionsQuery,
  useCreateLiveSessionMutation,
  useUpdateLiveSessionMutation,
  useDeleteLiveSessionMutation,
  useListUsersQuery,
} from '@/store/slices';

export function LiveSessionList({ role }: { role: 'tenant' | 'user' }) {
  const params = useParams<{ tenantSlug: string; userName?: string }>();
  const { user: currentUser } = useAuth();
  const canCreateOrHost = canHostLiveSession(currentUser);
  
  const { data: sessionsRes, isLoading, refetch } = useListLiveSessionsQuery();
  const { data: usersRes } = useListUsersQuery(undefined, {
    skip: !canCreateOrHost,
  });

  const [createSession] = useCreateLiveSessionMutation();
  const [updateSession] = useUpdateLiveSessionMutation();
  const [deleteSession] = useDeleteLiveSessionMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !scheduledStartTime) {
      setErrorMsg('Title and Start Time are required');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await createSession({
        title,
        description: description || undefined,
        scheduledStartTime: new Date(scheduledStartTime).toISOString(),
        invitedUserIds,
      }).unwrap();
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setScheduledStartTime('');
      setInvitedUserIds([]);
      refetch();
    } catch (err: any) {
      setErrorMsg(err.data?.message || 'Failed to create live session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'upcoming' | 'live' | 'ended') => {
    try {
      await updateSession({ id, status }).unwrap();
      refetch();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this live session?')) return;
    try {
      await deleteSession(id).unwrap();
      refetch();
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  const handleToggleInvite = (userId: string) => {
    setInvitedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const sessions = sessionsRes?.data || [];
  const users = (usersRes?.users ?? []).filter(
    (member: TenantUserDto) => member.id !== currentUser?.id && member.role === 'user',
  );

  const getWatchPath = (sessionId: string) => {
    if (role === 'tenant') {
      return `/${params.tenantSlug}/live-sessions/${sessionId}`;
    }
    return `${dashboardHome(currentUser)}/live-sessions/${sessionId}`;
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Live Stream Sessions
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {canCreateOrHost
              ? 'Schedule, stream, and interact with members in real-time.'
              : 'Join scheduled live streams and participate in discussion chat.'}
          </p>
        </div>
        {canCreateOrHost && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-md shadow-slate-950/10 dark:bg-accent dark:hover:bg-accent/90"
          >
            Create Live Session
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin dark:border-accent dark:border-t-transparent"></div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-200 rounded-2xl dark:bg-slate-900/20 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400">No live sessions scheduled.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const isLive = session.status === 'live';
            const isUpcoming = session.status === 'upcoming';
            const isEnded = session.status === 'ended';
            const canHostThis =
              isTenantAdmin(currentUser) ||
              (canCreateOrHost && session.host.id === currentUser?.id);

            return (
              <div
                key={session.id}
                className={`relative flex flex-col justify-between p-6 rounded-2xl border transition-all duration-300 ${
                  isLive
                    ? 'bg-gradient-to-br from-red-500/5 to-orange-500/5 border-red-500/30 shadow-lg shadow-red-500/5 dark:border-red-500/40'
                    : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                        isLive
                          ? 'bg-red-100 text-red-700 animate-pulse dark:bg-red-950/50 dark:text-red-400'
                          : isUpcoming
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {session.status}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      Host: {session.host.name || session.host.username}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
                    {session.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[2.5rem]">
                    {session.description || 'No description provided.'}
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/60 space-y-2">
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold mr-1">Starts:</span>
                      {formatDate(session.scheduledStartTime)}
                    </div>
                    {canCreateOrHost && (
                      <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold mr-1">Invited:</span>
                        {session.invitedUsers.length} members
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2 items-center">
                  <Link
                    href={getWatchPath(session.id)}
                    className={`flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      isLive
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/10'
                        : isEnded
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                        : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-accent dark:hover:bg-accent/90'
                    }`}
                  >
                    {isLive
                      ? 'Join Live Room'
                      : isEnded
                        ? session.recordingStatus === 'ready'
                          ? 'Watch Recording'
                          : session.recordingStatus === 'processing'
                            ? 'Processing…'
                            : 'View Archive'
                        : 'Enter Room'}
                  </Link>

                  {canHostThis && (
                    <div className="flex gap-1">
                      {isUpcoming && (
                        <button
                          onClick={() => handleUpdateStatus(session.id, 'live')}
                          title="Start Live Stream"
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg dark:text-emerald-400 dark:hover:bg-emerald-950/20"
                        >
                          ▶
                        </button>
                      )}
                      {isLive && (
                        <button
                          onClick={() => handleUpdateStatus(session.id, 'ended')}
                          title="End Live Stream"
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg dark:text-rose-400 dark:hover:bg-rose-950/20"
                        >
                          ■
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(session.id)}
                        title="Delete Session"
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-400"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Creating Live Session */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <div className="relative bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Create Live Stream Session
              </h2>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg dark:bg-red-950/30 dark:text-red-400">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weekly Q&A Session"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional details about the live stream session..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Scheduled Start Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Invite Members (Learners strictly required)
                </label>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-950">
                  {users.length === 0 ? (
                    <p className="p-3 text-sm text-slate-400 text-center">No members available to invite.</p>
                  ) : (
                    users.map((member: TenantUserDto) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 p-2.5 hover:bg-slate-100/50 cursor-pointer dark:hover:bg-slate-900/30"
                      >
                        <input
                          type="checkbox"
                          checked={invitedUserIds.includes(member.id)}
                          onChange={() => handleToggleInvite(member.id)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900/10 dark:border-slate-800"
                        />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-950 dark:text-white leading-none">
                            {member.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            @{member.username} ({member.access || member.role})
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg dark:bg-accent dark:hover:bg-accent/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
