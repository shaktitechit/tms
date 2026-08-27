import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { parseLessonForm } from './lesson.form.parser.js';
import { LessonService } from './lesson.service.js';
import {
  createLessonSchema,
  reorderLessonContentSchema,
  reorderLessonsSchema,
  updateLessonSchema,
} from './lesson.validators.js';

export class LessonController {
  private readonly lessons: LessonService;

  constructor(ctx: AppContext) {
    this.lessons = new LessonService(ctx);
  }

  private actor(req: Request) {
    if (!req.user) {
      throw unauthorized();
    }
    return req.user;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const moduleRef = typeof req.query.module === 'string' ? req.query.module : undefined;
      const lessons = await this.lessons.list(this.actor(req), { module: moduleRef });
      res.json({ success: true, lessons });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lesson = await this.lessons.getById(this.actor(req), req.params.id as string);
      res.json({ success: true, lesson });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = this.actor(req);
      const contentType = req.headers['content-type'] ?? '';

      if (contentType.includes('multipart/form-data')) {
        const form = await parseLessonForm(req);
        const lesson = await this.lessons.createFromForm(actor, form);
        res.status(201).json({ success: true, lesson });
        return;
      }

      const body = createLessonSchema.parse(req.body);
      const lesson = await this.lessons.create(actor, body);
      res.status(201).json({ success: true, lesson });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = this.actor(req);
      const id = req.params.id as string;
      const contentType = req.headers['content-type'] ?? '';

      if (contentType.includes('multipart/form-data')) {
        const form = await parseLessonForm(req);
        const lesson = await this.lessons.updateFromForm(actor, id, form);
        res.json({ success: true, lesson });
        return;
      }

      const body = updateLessonSchema.parse(req.body);
      const lesson = await this.lessons.update(actor, id, body);
      res.json({ success: true, lesson });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.lessons.remove(this.actor(req), req.params.id as string);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  reorder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = reorderLessonsSchema.parse(req.body);
      const lessons = await this.lessons.reorder(this.actor(req), body);
      res.json({ success: true, lessons });
    } catch (error) {
      next(error);
    }
  };

  reorderContent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = reorderLessonContentSchema.parse(req.body);
      const result = await this.lessons.reorderContent(
        this.actor(req),
        req.params.id as string,
        body.items,
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  thumbnail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.lessons.pipeThumbnail(this.actor(req), req.params.id as string, res);
    } catch (error) {
      next(error);
    }
  };
}
