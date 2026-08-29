import { liveSessionRepository } from './live-session.repository.js';
import { liveSessionEventEmitter, LiveSessionEvents } from './live-session.events.js';
import { finalizeSessionRecording } from './session-recording.js';
import { isTutorActor } from '../../http/access.js';
import { forbidden, notFound } from '../../http/errors.js';
import type { LiveSessionDocument } from '../../models/index.js';
import { UserRole } from '@video/shared';

type LiveSessionActor = { id: string; role: string; access?: string | null };

function hostIdOf(session: LiveSessionDocument): string {
  const host = session.hostId as { _id?: unknown } | unknown;
  if (typeof host === 'object' && host !== null && '_id' in host) {
    return String((host as { _id: unknown })._id);
  }
  return String(host);
}

function isInvited(session: LiveSessionDocument, userId: string): boolean {
  return (session.invitedUserIds ?? []).some((uid) => String((uid as { _id?: unknown })._id ?? uid) === userId);
}

function canSeeAllTenantSessions(actor: LiveSessionActor): boolean {
  return actor.role === UserRole.TENANT || isTutorActor(actor);
}

function canJoinSession(session: LiveSessionDocument, actor: LiveSessionActor): boolean {
  if (canSeeAllTenantSessions(actor)) {
    return true;
  }
  return hostIdOf(session) === actor.id || isInvited(session, actor.id);
}

function canManageSession(session: LiveSessionDocument, actor: LiveSessionActor): boolean {
  return actor.role === UserRole.TENANT || hostIdOf(session) === actor.id;
}

export const liveSessionService = {
  async createSession(
    tenantId: string,
    hostId: string,
    data: {
      title: string;
      description?: string;
      scheduledStartTime: string;
      invitedUserIds?: string[];
    }
  ) {
    const session = await liveSessionRepository.create({
      title: data.title,
      description: data.description,
      tenantId: tenantId as any,
      hostId: hostId as any,
      status: 'upcoming',
      scheduledStartTime: new Date(data.scheduledStartTime),
      invitedUserIds: (data.invitedUserIds || []) as any[],
    });

    return session;
  },

  async listSessions(tenantId: string, user: LiveSessionActor) {
    if (canSeeAllTenantSessions(user)) {
      return liveSessionRepository.find({ tenantId });
    }

    return liveSessionRepository.find({
      tenantId,
      $or: [{ hostId: user.id }, { invitedUserIds: user.id }],
    });
  },

  async getSession(id: string, tenantId: string, actor: LiveSessionActor) {
    const session = await liveSessionRepository.findById(id);
    if (!session || String(session.tenantId) !== tenantId) {
      throw notFound('Live session not found');
    }

    if (!canJoinSession(session, actor)) {
      throw forbidden('You are not invited to this session');
    }

    return session;
  },

  async updateSession(
    id: string,
    tenantId: string,
    actor: LiveSessionActor,
    patch: {
      title?: string;
      description?: string;
      status?: 'upcoming' | 'live' | 'ended';
      scheduledStartTime?: string;
      invitedUserIds?: string[];
    }
  ) {
    const session = await liveSessionRepository.findById(id);
    if (!session || String(session.tenantId) !== tenantId) {
      throw notFound('Live session not found');
    }

    if (!canManageSession(session, actor)) {
      throw forbidden('Only the host or tenant admin can update this session');
    }

    const updatePatch: Partial<LiveSessionDocument> = {};
    if (patch.title !== undefined) updatePatch.title = patch.title;
    if (patch.description !== undefined) updatePatch.description = patch.description;
    if (patch.status !== undefined) updatePatch.status = patch.status;
    if (patch.scheduledStartTime !== undefined) {
      updatePatch.scheduledStartTime = new Date(patch.scheduledStartTime);
    }
    if (patch.invitedUserIds !== undefined) {
      updatePatch.invitedUserIds = patch.invitedUserIds as any[];
    }

    if (patch.status === 'ended' && session.status !== 'ended') {
      (updatePatch as { endedAt?: Date }).endedAt = new Date();
    }

    const updated = await liveSessionRepository.updateById(id, tenantId, updatePatch);
    if (patch.status && patch.status !== session.status) {
      liveSessionEventEmitter.emit(LiveSessionEvents.STATUS, {
        liveSessionId: id,
        status: patch.status,
      });
    }
    if (patch.status === 'ended') {
      void finalizeSessionRecording(id);
    }
    return updated;
  },

  async deleteSession(id: string, tenantId: string, actor: LiveSessionActor) {
    const session = await liveSessionRepository.findById(id);
    if (!session || String(session.tenantId) !== tenantId) {
      throw notFound('Live session not found');
    }

    if (!canManageSession(session, actor)) {
      throw forbidden('Only the host or tenant admin can delete this session');
    }

    await liveSessionRepository.deleteById(id, tenantId);
    await liveSessionRepository.deleteChatMessagesBySessionId(id);
    return { success: true };
  },

  // Live Chat
  async postChatMessage(
    liveSessionId: string,
    tenantId: string,
    actor: LiveSessionActor,
    message: string
  ) {
    const session = await liveSessionRepository.findById(liveSessionId);
    if (!session || String(session.tenantId) !== tenantId) {
      throw notFound('Live session not found');
    }

    if (session.status === 'ended') {
      throw forbidden('This live session has ended. Chat is closed.');
    }

    if (!canJoinSession(session, actor)) {
      throw forbidden('You are not invited to this session');
    }

    const chatMsg = await liveSessionRepository.createChatMessage({
      liveSessionId: liveSessionId as any,
      tenantId: tenantId as any,
      senderId: actor.id as any,
      message,
    });

    // Populate sender details for real-time notification
    const populated = await chatMsg.populate('senderId', 'name username');

    // Broadcast message
    liveSessionEventEmitter.emit(LiveSessionEvents.CHAT_MESSAGE, {
      liveSessionId,
      message: populated,
    });

    return populated;
  },

  async getChatHistory(liveSessionId: string, tenantId: string, actor: LiveSessionActor) {
    const session = await liveSessionRepository.findById(liveSessionId);
    if (!session || String(session.tenantId) !== tenantId) {
      throw notFound('Live session not found');
    }

    if (!canJoinSession(session, actor)) {
      throw forbidden('You are not invited to this session');
    }

    return liveSessionRepository.findChatMessages(liveSessionId);
  }
};
