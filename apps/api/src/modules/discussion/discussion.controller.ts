import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { DiscussionService } from './discussion.service.js';

export class DiscussionController {
  private readonly discussions: DiscussionService;

  constructor(_ctx: AppContext) {
    this.discussions = new DiscussionService();
  }

  private actor(req: Request) {
    if (!req.user) {
      throw unauthorized();
    }
    return req.user;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const videoId = typeof req.query.videoId === 'string' ? req.query.videoId : undefined;
      const lessonId = typeof req.query.lessonId === 'string' ? req.query.lessonId : undefined;
      const parentId = typeof req.query.parentId === 'string' ? req.query.parentId : undefined;
      const discussions = await this.discussions.list(this.actor(req), {
        videoId,
        lessonId,
        parentId,
      });
      res.json({ success: true, discussions });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const discussion = await this.discussions.getById(this.actor(req), req.params.id as string);
      res.json({ success: true, discussion });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const discussion = await this.discussions.create(this.actor(req), req.body);
      res.status(201).json({ success: true, discussion });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const discussion = await this.discussions.update(
        this.actor(req),
        req.params.id as string,
        req.body,
      );
      res.json({ success: true, discussion });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.discussions.remove(this.actor(req), req.params.id as string);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}
