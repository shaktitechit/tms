import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { parseTenantForm } from './tenant.form.parser.js';
import { TenantService } from './tenant.service.js';
import { updateTenantSchema } from './tenant.validators.js';

export class TenantController {
  private readonly tenants: TenantService;

  constructor(ctx: AppContext) {
    this.tenants = new TenantService(ctx);
  }

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }
      const tenant = await this.tenants.getForUser(req.user);
      res.json({ success: true, tenant });
    } catch (error) {
      next(error);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }

      const contentType = req.headers['content-type'] ?? '';
      if (contentType.includes('multipart/form-data')) {
        const form = await parseTenantForm(req);
        const tenant = await this.tenants.updateForUser(req.user, { name: form.name }, form.logo);
        res.json({ success: true, tenant });
        return;
      }

      const body = updateTenantSchema.parse(req.body);
      const tenant = await this.tenants.updateForUser(req.user, body);
      res.json({ success: true, tenant });
    } catch (error) {
      next(error);
    }
  };

  logo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }
      await this.tenants.pipeLogo(req.user, res);
    } catch (error) {
      next(error);
    }
  };
}
