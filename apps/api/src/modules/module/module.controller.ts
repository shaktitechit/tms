import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { parseModuleForm } from './module.form.parser.js';
import { ModuleService } from './module.service.js';
import { createModuleSchema, updateModuleSchema } from './module.validators.js';

export class ModuleController {
  private readonly modules: ModuleService;

  constructor(ctx: AppContext) {
    this.modules = new ModuleService(ctx);
  }

  private actor(req: Request) {
    if (!req.user) {
      throw unauthorized();
    }
    return req.user;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const department =
        typeof req.query.department === 'string' ? req.query.department : undefined;
      const modules = await this.modules.list(this.actor(req), { department });
      res.json({ success: true, modules });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const module = await this.modules.getById(this.actor(req), req.params.id as string);
      res.json({ success: true, module });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = this.actor(req);
      const contentType = req.headers['content-type'] ?? '';

      if (contentType.includes('multipart/form-data')) {
        const form = await parseModuleForm(req);
        const module = await this.modules.createFromForm(actor, form);
        res.status(201).json({ success: true, module });
        return;
      }

      const body = createModuleSchema.parse(req.body);
      const module = await this.modules.create(actor, body);
      res.status(201).json({ success: true, module });
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
        const form = await parseModuleForm(req);
        const module = await this.modules.updateFromForm(actor, id, form);
        res.json({ success: true, module });
        return;
      }

      const body = updateModuleSchema.parse(req.body);
      const module = await this.modules.update(actor, id, body);
      res.json({ success: true, module });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.modules.remove(this.actor(req), req.params.id as string);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  thumbnail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.modules.pipeThumbnail(this.actor(req), req.params.id as string, res);
    } catch (error) {
      next(error);
    }
  };
}
