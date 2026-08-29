import type { LiveSessionDocument, LiveChatMessageDocument } from '../../models/index.js';
import type mongoose from 'mongoose';

type PopulatedUser = {
  _id: mongoose.Types.ObjectId;
  name: string;
  username: string;
  email?: string;
};

function userFields(raw: unknown) {
  if (typeof raw === 'object' && raw !== null && 'name' in raw) {
    const user = raw as PopulatedUser;
    return {
      id: String(user._id),
      name: user.name,
      username: user.username,
      email: user.email,
    };
  }
  return {
    id: String(raw),
    name: null,
    username: null,
    email: null,
  };
}

type PopulatedVideo = {
  _id: mongoose.Types.ObjectId;
  status?: string;
  hlsMasterPlaylistKey?: string;
  thumbnailStorageKey?: string;
};

function recordingFields(session: LiveSessionDocument) {
  const raw = (session as LiveSessionDocument & { recordingVideoId?: unknown }).recordingVideoId;
  const video =
    typeof raw === 'object' && raw !== null && 'status' in raw ? (raw as PopulatedVideo) : null;
  const videoId = video ? String(video._id) : raw ? String(raw) : null;
  const storedStatus = (session as LiveSessionDocument & { recordingStatus?: string }).recordingStatus || 'none';

  let recordingStatus = storedStatus;
  if (video?.status === 'READY') recordingStatus = 'ready';
  else if (video?.status === 'FAILED') recordingStatus = 'failed';
  else if (video && ['QUEUED', 'PROCESSING', 'UPLOADED', 'UPLOADING'].includes(video.status || '')) {
    recordingStatus = 'processing';
  }

  return {
    recordingStatus,
    recordingVideoId: videoId,
    playbackUrl: video?.status === 'READY' ? `/api/videos/${videoId}/hls/master.m3u8` : null,
    thumbnailUrl: video?.thumbnailStorageKey ? `/api/videos/${videoId}/thumbnail` : null,
  };
}

export function serializeLiveSession(session: LiveSessionDocument) {
  const host = session.hostId;
  const invited = (session.invitedUserIds || []).map((uid) => userFields(uid));

  return {
    id: String(session._id),
    title: session.title,
    description: session.description || null,
    tenantId: String(session.tenantId),
    host: userFields(host),
    status: session.status,
    scheduledStartTime: session.scheduledStartTime,
    invitedUsers: invited,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ...recordingFields(session),
  };
}

export function serializeLiveChatMessage(msg: LiveChatMessageDocument) {
  return {
    id: String(msg._id),
    liveSessionId: String(msg.liveSessionId),
    tenantId: String(msg.tenantId),
    sender: userFields(msg.senderId),
    message: msg.message,
    createdAt: msg.createdAt,
  };
}
