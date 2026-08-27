import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { TextAreaService } from './text-area.service.js';
import { createTextAreaSchema, updateTextAreaSchema } from './text-area.validators.js';

export class TextAreaController {
  private readonly service: TextAreaService;

  constructor(ctx: AppContext) {
    this.service = new TextAreaService(ctx);
  }

  private actor(req: Request) {
    if (!req.user) {
      throw unauthorized();
    }
    return req.user;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lesson = typeof req.query.lesson === 'string' ? req.query.lesson : undefined;
      const textAreas = await this.service.list(this.actor(req), { lesson });
      res.json({ success: true, textAreas });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const textArea = await this.service.getById(this.actor(req), req.params.id as string);
      res.json({ success: true, textArea });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createTextAreaSchema.parse(req.body);
      const textArea = await this.service.create(this.actor(req), body);
      res.status(201).json({ success: true, textArea });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = updateTextAreaSchema.parse(req.body);
      const textArea = await this.service.update(this.actor(req), req.params.id as string, body);
      res.json({ success: true, textArea });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.remove(this.actor(req), req.params.id as string);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  markSeen = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const textArea = await this.service.markSeen(this.actor(req), req.params.id as string);
      res.json({ success: true, textArea });
    } catch (error) {
      next(error);
    }
  };
}
