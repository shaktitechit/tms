import type { NextFunction, Request, Response } from 'express';
import { liveSessionService } from './live-session.service.js';
import { serializeLiveSession, serializeLiveChatMessage } from './live-session.serializer.js';
import { liveSessionEventEmitter, LiveSessionEvents } from './live-session.events.js';
import { badRequest, unauthorized } from '../../http/errors.js';

interface AuthUser {
  id: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
  username: string;
  email?: string;
  name?: string;
  access?: string | null;
}

function getActor(req: Request): AuthUser {
  if (!req.user) {
    throw unauthorized();
  }
  return req.user as unknown as AuthUser;
}

export const liveSessionController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getActor(req);
      const session = await liveSessionService.createSession(user.tenantId, user.id, req.body);
      res.status(201).json({
        success: true,
        data: serializeLiveSession(session),
      });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getActor(req);
      const sessions = await liveSessionService.listSessions(user.tenantId, user);
      res.json({
        success: true,
        data: sessions.map(serializeLiveSession),
      });
    } catch (err) {
      next(err);
    }
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getActor(req);
      const id = req.params.id || '';
      const session = await liveSessionService.getSession(id, user.tenantId, user);
      res.json({
        success: true,
        data: serializeLiveSession(session),
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getActor(req);
      const id = req.params.id || '';
      const session = await liveSessionService.updateSession(id, user.tenantId, user, req.body);
      if (!session) {
        throw badRequest('Could not update live session');
      }
      res.json({
        success: true,
        data: serializeLiveSession(session),
      });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getActor(req);
      const id = req.params.id || '';
      const result = await liveSessionService.deleteSession(id, user.tenantId, user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async postChatMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getActor(req);
      const id = req.params.id || '';
      const message = await liveSessionService.postChatMessage(
        id,
        user.tenantId,
        user,
        req.body.message || ''
      );
      res.status(201).json({
        success: true,
        data: serializeLiveChatMessage(message),
      });
    } catch (err) {
      next(err);
    }
  },

  async getChatHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getActor(req);
      const id = req.params.id || '';
      const history = await liveSessionService.getChatHistory(id, user.tenantId, user);
      res.json({
        success: true,
        data: history.map(serializeLiveChatMessage),
      });
    } catch (err) {
      next(err);
    }
  },

  async chatStream(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getActor(req);
      const liveSessionId = req.params.id || '';

      // Verify access to the session first
      await liveSessionService.getSession(liveSessionId, user.tenantId, user);

      // Set headers for Server-Sent Events (SSE)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx/proxies
      res.flushHeaders();

      // Send initial heartbeat / connection established comment
      res.write(': ok\n\n');

      const messageListener = (event: { liveSessionId: string; message: any }) => {
        if (event.liveSessionId === liveSessionId) {
          const serialized = serializeLiveChatMessage(event.message);
          res.write(`data: ${JSON.stringify(serialized)}\n\n`);
        }
      };

      liveSessionEventEmitter.on(LiveSessionEvents.CHAT_MESSAGE, messageListener);

      // Set up a heartbeat interval to keep connection alive
      const heartbeatInterval = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, 30000);

      req.on('close', () => {
        clearInterval(heartbeatInterval);
        liveSessionEventEmitter.removeListener(LiveSessionEvents.CHAT_MESSAGE, messageListener);
      });
    } catch (err) {
      next(err);
    }
  }
};
