import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import { UserService } from './user.service.js';

export class UserController {
  private readonly users = new UserService();

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }
      const users = await this.users.list(req.user);
      res.json({ success: true, users });
    } catch (error) {
      next(error);
    }
  };

  listMyLearners = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }
      const users = await this.users.listByTutor(req.user);
      res.json({ success: true, users });
    } catch (error) {
      next(error);
    }
  };

  createLearner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }
      const user = await this.users.createLearner(req.user, req.body);
      res.status(201).json({ success: true, user });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }
      const user = await this.users.getById(req.user, req.params.id as string);
      res.json({ success: true, user });
    } catch (error) {
      next(error);
    }
  };

  getProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }
      const progress = await this.users.getProgress(req.user, req.params.id as string);
      res.json({ success: true, ...progress });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }
      const user = await this.users.create(req.user, req.body);
      res.status(201).json({ success: true, user });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }
      const user = await this.users.update(req.user, req.params.id as string, req.body);
      res.json({ success: true, user });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }
      const result = await this.users.remove(req.user, req.params.id as string);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}
