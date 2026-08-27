import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { QuizService } from './quiz.service.js';
import { createQuizSchema, markQuizSeenSchema, updateQuizSchema } from './quiz.validators.js';

export class QuizController {
  private readonly service: QuizService;

  constructor(ctx: AppContext) {
    this.service = new QuizService(ctx);
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
      const quizzes = await this.service.list(this.actor(req), { lesson });
      res.json({ success: true, quizzes });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const quiz = await this.service.getById(this.actor(req), req.params.id as string);
      res.json({ success: true, quiz });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createQuizSchema.parse(req.body);
      const quiz = await this.service.create(this.actor(req), body);
      res.status(201).json({ success: true, quiz });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = updateQuizSchema.parse(req.body);
      const quiz = await this.service.update(this.actor(req), req.params.id as string, body);
      res.json({ success: true, quiz });
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
      const body = markQuizSeenSchema.parse(req.body ?? {});
      const quiz = await this.service.markSeen(this.actor(req), req.params.id as string, body);
      res.json({ success: true, quiz });
    } catch (error) {
      next(error);
    }
  };
}
