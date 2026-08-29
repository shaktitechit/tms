import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { MemberAccess, UserRole } from '@video/shared';
import { mongoRegistry } from '../data/mongoRegistry.js';
import { canManageCurriculum, isTutorActor } from '../http/access.js';
import { forbidden, unauthorized } from '../http/errors.js';
import type { AppContext } from '../types.js';

export interface AuthPayload {
  sub: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
  username: string;
  access?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        tenantId: string;
        tenantSlug: string;
        username: string;
        email?: string;
        name?: string;
        access?: MemberAccess | null;
      };
    }
  }
}

export function signAuthToken(
  ctx: AppContext,
  input: {
    userId: string;
    role: string;
    tenantId: string;
    tenantSlug: string;
    username: string;
    access?: string | null;
  },
): string {
  return jwt.sign(
    {
      sub: input.userId,
      role: input.role,
      tenantId: input.tenantId,
      tenantSlug: input.tenantSlug,
      username: input.username,
      access: input.access ?? null,
    } satisfies AuthPayload,
    ctx.env.JWT_SECRET,
    {
      expiresIn: ctx.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
}

function cookieSecure(ctx: AppContext): boolean {
  if (process.env.COOKIE_SECURE === 'true') {
    return true;
  }
  if (process.env.COOKIE_SECURE === 'false') {
    return false;
  }
  return ctx.env.CORS_ORIGIN.split(',').some((origin) => origin.trim().startsWith('https://'));
}

export function setAuthCookie(ctx: AppContext, res: Response, token: string): void {
  res.cookie(ctx.env.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(ctx),
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(ctx: AppContext, res: Response): void {
  res.clearCookie(ctx.env.COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(ctx),
    path: '/',
  });
}

export function optionalAuth(ctx: AppContext) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.[ctx.env.COOKIE_NAME] as string | undefined;
      if (!token) {
        next();
        return;
      }
      const payload = jwt.verify(token, ctx.env.JWT_SECRET) as AuthPayload;
      const user = await mongoRegistry.models.User.findById(payload.sub).lean();
      if (user) {
        const tenant = await mongoRegistry.models.Tenant.findById(user.tenantId).lean();
        req.user = {
          id: String(user._id),
          role: user.role,
          tenantId: String(user.tenantId),
          tenantSlug: tenant?.slug ?? payload.tenantSlug,
          username: user.username,
          email: user.email,
          name: user.name,
          access:
            user.role === 'user'
              ? (user.access ?? payload.access ?? MemberAccess.LEARNER)
              : null,
        };
      }
      next();
    } catch {
      next();
    }
  };
}

export function requireAuth(ctx: AppContext) {
  const optional = optionalAuth(ctx);
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await optional(req, res, (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }
      if (!req.user) {
        next(unauthorized());
        return;
      }
      next();
    });
  };
}

/** Requires an authenticated user whose role is one of `roles`. */
export function requireRole(...roles: Array<UserRole | string>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(forbidden());
      return;
    }
    next();
  };
}

export const requireTenantAdmin = requireRole(UserRole.TENANT);

/** Tenant admin or member with tutor access. */
export function requireTenantOrTutor(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  if (canManageCurriculum(req.user)) {
    next();
    return;
  }
  next(forbidden());
}

/** Member with tutor access (not tenant admin). */
export function requireTutor(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  if (isTutorActor(req.user)) {
    next();
    return;
  }
  next(forbidden());
}
