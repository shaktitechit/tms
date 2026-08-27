import type { Request, Response, NextFunction } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { AuthService } from './auth.service.js';

export class AuthController {
  private readonly authService: AuthService;

  constructor(ctx: AppContext) {
    this.authService = new AuthService(ctx);
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user, token } = await this.authService.register(req.body, res);
      // `token` lets the Next.js BFF set the httpOnly cookie reliably.
      res.status(201).json({ success: true, user, token });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user, token } = await this.authService.login(req.body, res);
      res.json({ success: true, user, token });
    } catch (error) {
      next(error);
    }
  };

  logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.authService.logout(res);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw unauthorized();
      }
      res.json({
        success: true,
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          username: req.user.username,
          role: req.user.role,
          tenantId: req.user.tenantId,
          tenantSlug: req.user.tenantSlug,
          access: req.user.access ?? null,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
