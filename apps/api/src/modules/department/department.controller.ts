import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { parseDepartmentForm } from './department.form.parser.js';
import { DepartmentService } from './department.service.js';
import { createDepartmentSchema, updateDepartmentSchema } from './department.validators.js';

export class DepartmentController {
  private readonly departments: DepartmentService;

  constructor(ctx: AppContext) {
    this.departments = new DepartmentService(ctx);
  }

  private actor(req: Request) {
    if (!req.user) {
      throw unauthorized();
    }
    return req.user;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const departments = await this.departments.list(this.actor(req));
      res.json({ success: true, departments });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const department = await this.departments.getById(
        this.actor(req),
        req.params.id as string,
      );
      res.json({ success: true, department });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = this.actor(req);
      const contentType = req.headers['content-type'] ?? '';

      if (contentType.includes('multipart/form-data')) {
        const form = await parseDepartmentForm(req);
        const department = await this.departments.createFromForm(actor, form);
        res.status(201).json({ success: true, department });
        return;
      }

      const body = createDepartmentSchema.parse(req.body);
      const department = await this.departments.create(actor, body);
      res.status(201).json({ success: true, department });
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
        const form = await parseDepartmentForm(req);
        const department = await this.departments.updateFromForm(actor, id, form);
        res.json({ success: true, department });
        return;
      }

      const body = updateDepartmentSchema.parse(req.body);
      const department = await this.departments.update(actor, id, body);
      res.json({ success: true, department });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.departments.remove(this.actor(req), req.params.id as string);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  thumbnail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.departments.pipeThumbnail(this.actor(req), req.params.id as string, res);
    } catch (error) {
      next(error);
    }
  };
}
