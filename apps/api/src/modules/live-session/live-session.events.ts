import { EventEmitter } from 'events';

export const liveSessionEventEmitter = new EventEmitter();

// Limit listeners warning threshold
liveSessionEventEmitter.setMaxListeners(100);

export const LiveSessionEvents = {
  CHAT_MESSAGE: 'chat-message',
  STATUS: 'session-status',
};
