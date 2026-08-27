import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import { MemberModuleService } from './member-module.service.js';

export class MemberModuleController {
  private readonly memberModules = new MemberModuleService();

  private actor(req: Request) {
    if (!req.user) {
      throw unauthorized();
    }
    return req.user;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
      const memberModules = await this.memberModules.list(this.actor(req), userId);
      res.json({ success: true, memberModules });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const memberModule = await this.memberModules.getById(this.actor(req), req.params.id as string);
      res.json({ success: true, memberModule });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const memberModule = await this.memberModules.create(this.actor(req), req.body);
      res.status(201).json({ success: true, memberModule });
    } catch (error) {
      next(error);
    }
  };

  replace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const memberModules = await this.memberModules.replace(this.actor(req), req.body);
      res.json({ success: true, memberModules });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.memberModules.remove(this.actor(req), req.params.id as string);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}
