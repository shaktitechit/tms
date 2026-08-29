import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'http';
import { createRedisConnection } from '@video/shared/server';
import type { AppContext } from './types.js';
import { liveSessionService } from './modules/live-session/live-session.service.js';
import { serializeLiveChatMessage } from './modules/live-session/live-session.serializer.js';
import { liveSessionEventEmitter, LiveSessionEvents } from './modules/live-session/live-session.events.js';
import { ffmpegBridge } from './modules/live-session/ffmpeg.js';
import { finalizeSessionRecording, markSessionRecording } from './modules/live-session/session-recording.js';
import { MemberAccess, UserRole } from '@video/shared';
import { isTutorActor } from './http/access.js';
import jwt from 'jsonwebtoken';
import type { AuthPayload } from './middlewares/auth.middleware.js';

import { mongoRegistry } from './data/mongoRegistry.js';

interface SocketUser {
  id: string;
  role: string;
  tenantId: string;
  username: string;
  name: string;
  access?: string | null;
}

// Custom cookie parsing helper since we don't want extra dependencies if not needed
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.slice(1).join('='));
    }
  });
  return list;
}

export function initSocketServer(httpServer: HttpServer, ctx: AppContext): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Setup Redis Adapter for multi-instance scaling
  try {
    const pubClient = createRedisConnection(ctx.env);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    ctx.logger.info('Socket.IO Redis adapter initialized successfully');
  } catch (err) {
    ctx.logger.error(err, 'Failed to initialize Socket.IO Redis adapter');
  }

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.request.headers.cookie;
      const cookies = parseCookies(cookieHeader);
      let token = cookies[ctx.env.COOKIE_NAME];

      if (!token) {
        const authObj = socket.handshake.auth as Record<string, unknown> | undefined;
        if (typeof authObj?.token === 'string' && authObj.token) {
          token = authObj.token;
        } else if (typeof socket.handshake.query?.token === 'string' && socket.handshake.query.token) {
          token = socket.handshake.query.token;
        } else if (socket.handshake.headers.authorization) {
          const authHeader = socket.handshake.headers.authorization;
          if (authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7).trim();
          }
        }
      }

      if (!token) {
        ctx.logger.warn({ ip: socket.handshake.address }, 'Socket authentication failed: Missing token');
        return next(new Error('Authentication failed: Missing token'));
      }

      const payload = jwt.verify(token, ctx.env.JWT_SECRET) as AuthPayload;
      
      let name = '';
      let access: string | null = null;
      try {
        const userObj = await mongoRegistry.models.User.findById(payload.sub).lean();
        if (userObj) {
          name = userObj.name || '';
          access =
            userObj.role === UserRole.USER ? (userObj.access ?? MemberAccess.LEARNER) : null;
        }
      } catch (err) {
        // Fallback silently
      }

      socket.data.user = {
        id: payload.sub,
        role: payload.role,
        tenantId: payload.tenantId,
        username: payload.username || '',
        name,
        access,
      } as SocketUser;

      next();
    } catch (err) {
      ctx.logger.warn({ err }, 'Socket authentication failed: Invalid token');
      next(new Error('Authentication failed: Invalid token'));
    }
  });

  // Connection Handler
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    ctx.logger.info({ userId: user.id }, 'Socket client connected');

    socket.on('join-room', async (liveSessionId: string) => {
      try {
        if (!liveSessionId) {
          socket.emit('error-msg', 'Missing liveSessionId');
          return;
        }

        // Verify user access before letting them join
        const session = await liveSessionService.getSession(liveSessionId, user.tenantId, user);

        const roomName = `session:${liveSessionId}`;

        // Get list of existing clients in this room to establish peer-to-peer WebRTC connections
        const clients = await io.in(roomName).fetchSockets();
        const usersList = clients.map((c) => ({
          socketId: c.id,
          user: {
            ...(c.data.user as SocketUser),
            isCameraOn: c.data.isCameraOn || false,
            isMicMuted: c.data.isMicMuted || false,
            isScreenSharing: c.data.isScreenSharing || false,
          },
        }));

        // Join room
        await socket.join(roomName);
        socket.data.joinedRoomId = roomName;
        ctx.logger.info({ userId: user.id, roomName }, 'Client joined socket room');

        // Send existing room members to the new client
        socket.emit('room-users', usersList);

        // Notify existing room members that we joined
        socket.to(roomName).emit('user-joined', {
          socketId: socket.id,
          user: {
            ...user,
            isCameraOn: socket.data.isCameraOn || false,
            isMicMuted: socket.data.isMicMuted || false,
            isScreenSharing: socket.data.isScreenSharing || false,
          },
        });

        socket.emit('joined', { liveSessionId });
        if (session.status === 'live') {
          socket.emit('activate-media');
        }
      } catch (err: any) {
        socket.emit('error-msg', err.message || 'Failed to join room');
      }
    });

    socket.on('chat-message', async (data: { liveSessionId: string; message: string }) => {
      try {
        const { liveSessionId, message } = data;
        if (!liveSessionId || !message) {
          socket.emit('error-msg', 'Missing parameters');
          return;
        }

        // Service layer handles DB insertion, security audits, and triggering event emitter
        await liveSessionService.postChatMessage(
          liveSessionId,
          user.tenantId,
          user,
          message
        );
      } catch (err: any) {
        socket.emit('error-msg', err.message || 'Failed to send message');
      }
    });

    // WebRTC Signaling Forwarders
    socket.on('signal-offer', (data: { targetSocketId: string; offer: any }) => {
      io.to(data.targetSocketId).emit('signal-offer', {
        senderSocketId: socket.id,
        offer: data.offer,
      });
    });

    socket.on('signal-answer', (data: { targetSocketId: string; answer: any }) => {
      io.to(data.targetSocketId).emit('signal-answer', {
        senderSocketId: socket.id,
        answer: data.answer,
      });
    });

    socket.on('signal-ice-candidate', (data: { targetSocketId: string; candidate: any }) => {
      io.to(data.targetSocketId).emit('signal-ice-candidate', {
        senderSocketId: socket.id,
        candidate: data.candidate,
      });
    });

    socket.on('update-status', (status: { isCameraOn: boolean; isMicMuted: boolean; isScreenSharing?: boolean }) => {
      socket.data.isCameraOn = status.isCameraOn;
      socket.data.isMicMuted = status.isMicMuted;
      socket.data.isScreenSharing = status.isScreenSharing || false;
      
      const joinedRoomId = socket.data.joinedRoomId;
      if (joinedRoomId) {
        socket.to(joinedRoomId).emit('user-status-updated', {
          socketId: socket.id,
          status: status,
        });
      }
    });

    socket.on('host-set-mic', async (data: { liveSessionId: string; targetSocketId?: string; muted: boolean }) => {
      try {
        const liveSessionId = data?.liveSessionId;
        if (!liveSessionId) {
          socket.emit('error-msg', 'Missing liveSessionId');
          return;
        }

        const session = await liveSessionService.getSession(liveSessionId, user.tenantId, user);
        const isHost = String(session.hostId._id || session.hostId) === user.id;
        const isTutorOrAdmin = user.role === UserRole.TENANT || isTutorActor(user);
        if (!isHost && !isTutorOrAdmin) {
          socket.emit('error-msg', 'Only the host can control participant microphones');
          return;
        }

        const roomName = socket.data.joinedRoomId || `session:${liveSessionId}`;
        const payload = { muted: !!data.muted, fromHost: true };
        const target = data.targetSocketId;
        if (!target || target === 'all') {
          socket.to(roomName).emit('set-mic', payload);
        } else {
          io.to(target).emit('set-mic', payload);
        }
      } catch (err: any) {
        socket.emit('error-msg', err.message || 'Failed to update participant microphone');
      }
    });

    socket.on('session-start', async (liveSessionId: string) => {
      try {
        const session = await liveSessionService.getSession(liveSessionId, user.tenantId, user);
        const isHost = String(session.hostId._id || session.hostId) === user.id;
        const isTutorOrAdmin = user.role === UserRole.TENANT || isTutorActor(user);
        if (!isHost && !isTutorOrAdmin) {
          socket.emit('error-msg', 'Only the host can start the session');
          return;
        }

        const roomName = socket.data.joinedRoomId || `session:${liveSessionId}`;
        io.to(roomName).emit('activate-media');
        io.to(roomName).emit('session-status', { liveSessionId, status: 'live' });
      } catch (err: any) {
        socket.emit('error-msg', err.message || 'Failed to start session media');
      }
    });

    socket.on('stream-start', async (liveSessionId: string) => {
      try {
        // Validate host access before letting them start stream
        const session = await liveSessionService.getSession(liveSessionId, user.tenantId, user);
        
        const isHost = String(session.hostId._id || session.hostId) === user.id;
        const isTutorOrAdmin = user.role === UserRole.TENANT || isTutorActor(user);
        
        if (!isHost && !isTutorOrAdmin) {
          socket.emit('error-msg', 'Only the host or tutor can broadcast a live stream');
          return;
        }

        socket.data.streamingSessionId = liveSessionId;
        if (ffmpegBridge.isActive(liveSessionId)) {
          // New WebM header (reconnect / recorder restart) must not append to the old process.
          await ffmpegBridge.rotateTranscoding(liveSessionId, ctx.logger);
        } else {
          ffmpegBridge.startTranscoding(liveSessionId, ctx.logger);
        }
        void markSessionRecording(liveSessionId);
      } catch (err: any) {
        socket.emit('error-msg', err.message || 'Failed to initialize stream bridge');
      }
    });

    socket.on('stream-chunk', (data: { liveSessionId: string; chunk: Buffer }) => {
      const { liveSessionId, chunk } = data;
      if (liveSessionId && chunk) {
        ffmpegBridge.writeChunk(liveSessionId, chunk, ctx.logger);
      }
    });

    socket.on('stream-rotate', async (liveSessionId: string, ack?: () => void) => {
      try {
        if (liveSessionId && socket.data.streamingSessionId === liveSessionId) {
          await ffmpegBridge.rotateTranscoding(liveSessionId, ctx.logger);
        }
      } catch (err) {
        ctx.logger.error(err, 'Failed to rotate live session recording');
      } finally {
        if (typeof ack === 'function') ack();
      }
    });

    socket.on('stream-stop', (liveSessionId: string) => {
      if (liveSessionId) {
        socket.data.streamingSessionId = undefined;
        void finalizeSessionRecording(liveSessionId);
      }
    });

    socket.on('disconnect', () => {
      ctx.logger.info({ userId: user.id }, 'Socket client disconnected');
      
      const joinedRoomId = socket.data.joinedRoomId;
      if (joinedRoomId) {
        socket.to(joinedRoomId).emit('user-left', { socketId: socket.id });
      }

      // Leave FFmpeg running on disconnect so a reconnect can keep recording.
      // Finalization happens on stream-stop or when the session is ended.
    });
  });

  // Listen to system-wide Live Session Events (REST + Socket) to broadcast to rooms
  liveSessionEventEmitter.on(LiveSessionEvents.CHAT_MESSAGE, (event: { liveSessionId: string; message: any }) => {
    const roomName = `session:${event.liveSessionId}`;
    const serialized = serializeLiveChatMessage(event.message);
    io.to(roomName).emit('chat-message', serialized);
  });

  liveSessionEventEmitter.on(LiveSessionEvents.STATUS, (event: { liveSessionId: string; status: string }) => {
    io.to(`session:${event.liveSessionId}`).emit('session-status', event);
  });

  return io;
}
