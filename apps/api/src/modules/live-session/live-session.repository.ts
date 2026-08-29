import mongoose, { type FilterQuery } from 'mongoose';
import { mongoRegistry } from '../../data/mongoRegistry.js';
import type { LiveSessionDocument, LiveChatMessageDocument } from '../../models/index.js';

const HOST_FIELDS = 'name username email';
const SENDER_FIELDS = 'name username';

export const liveSessionRepository = {
  // Live Sessions
  create(data: Partial<LiveSessionDocument>) {
    return mongoRegistry.models.LiveSession.create(data);
  },

  find(query: FilterQuery<LiveSessionDocument>) {
    return mongoRegistry.models.LiveSession.find(query)
      .populate('hostId', HOST_FIELDS)
      .populate('recordingVideoId', 'status hlsMasterPlaylistKey thumbnailStorageKey originalStorageKey')
      .sort({ scheduledStartTime: 1 });
  },

  findById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return mongoRegistry.models.LiveSession.findById(id)
      .populate('hostId', HOST_FIELDS)
      .populate('invitedUserIds', 'name username email')
      .populate('recordingVideoId', 'status hlsMasterPlaylistKey thumbnailStorageKey originalStorageKey');
  },

  updateById(id: string, tenantId: string, patch: Partial<LiveSessionDocument>) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return mongoRegistry.models.LiveSession.findOneAndUpdate(
      { _id: id, tenantId },
      patch,
      { new: true }
    )
      .populate('hostId', HOST_FIELDS)
      .populate('invitedUserIds', 'name username email')
      .populate('recordingVideoId', 'status hlsMasterPlaylistKey thumbnailStorageKey originalStorageKey');
  },

  deleteById(id: string, tenantId: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return mongoRegistry.models.LiveSession.findOneAndDelete({ _id: id, tenantId });
  },

  // Live Chat Messages
  createChatMessage(data: Partial<LiveChatMessageDocument>) {
    return mongoRegistry.models.LiveChatMessage.create(data);
  },

  findChatMessages(liveSessionId: string) {
    if (!mongoose.Types.ObjectId.isValid(liveSessionId)) return [];
    return mongoRegistry.models.LiveChatMessage.find({ liveSessionId })
      .populate('senderId', SENDER_FIELDS)
      .sort({ createdAt: 1 });
  },

  deleteChatMessagesBySessionId(liveSessionId: string) {
    if (!mongoose.Types.ObjectId.isValid(liveSessionId)) return null;
    return mongoRegistry.models.LiveChatMessage.deleteMany({ liveSessionId });
  }
};
