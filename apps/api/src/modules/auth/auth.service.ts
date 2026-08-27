import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { AppError, ERROR_CODES, MemberAccess, UserRole } from '@video/shared';
import {
  clearAuthCookie,
  setAuthCookie,
  signAuthToken,
} from '../../middlewares/auth.middleware.js';
import type { AppContext } from '../../types.js';
import { tenantRepository } from '../tenant/tenant.repository.js';
import { userRepository } from '../user/user.repository.js';

const SALT_ROUNDS = 12;

function toAuthUser(input: {
  user: {
    _id: { toString(): string };
    email: string;
    name: string;
    username: string;
    role: string;
    access?: string | null;
    tenantId: { toString(): string };
  };
  tenantSlug: string;
}) {
  return {
    id: String(input.user._id),
    email: input.user.email,
    name: input.user.name,
    username: input.user.username,
    role: input.user.role,
    access:
      input.user.role === UserRole.USER
        ? (input.user.access ?? MemberAccess.LEARNER)
        : null,
    tenantId: String(input.user.tenantId),
    tenantSlug: input.tenantSlug,
  };
}

export class AuthService {
  constructor(private readonly ctx: AppContext) {}

  async register(
    input: { email: string; password: string; name: string; tenantName?: string },
    res: Response,
  ) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError('Email is already registered', ERROR_CODES.EMAIL_IN_USE, 409);
    }

    const tenantName = input.tenantName?.trim() || `${input.name.trim()}'s workspace`;
    const tenant = await tenantRepository.createUnique(tenantName);

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    let user;
    try {
      user = await userRepository.create({
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash,
        tenantId: String(tenant._id),
        role: UserRole.TENANT,
      });
    } catch (error) {
      await tenantRepository.findById(String(tenant._id)).then((doc) => doc?.deleteOne());
      throw error;
    }

    const token = signAuthToken(this.ctx, {
      userId: String(user._id),
      role: user.role,
      tenantId: String(user.tenantId),
      tenantSlug: tenant.slug,
      username: user.username,
    });
    setAuthCookie(this.ctx, res, token);

    return { user: toAuthUser({ user, tenantSlug: tenant.slug }), token };
  }

  async login(input: { email: string; password: string }, res: Response) {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw new AppError('Invalid email or password', ERROR_CODES.INVALID_CREDENTIALS, 401);
    }

    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) {
      throw new AppError('Invalid email or password', ERROR_CODES.INVALID_CREDENTIALS, 401);
    }

    const tenant = await tenantRepository.findById(String(user.tenantId));
    if (!tenant) {
      throw new AppError('Invalid email or password', ERROR_CODES.INVALID_CREDENTIALS, 401);
    }

    // Older accounts may predate the username field — allocate one on login.
    if (!user.username) {
      const username = await userRepository.allocateUsername(String(user.tenantId), user.name);
      user.username = username;
      await user.save();
    }

    const token = signAuthToken(this.ctx, {
      userId: String(user._id),
      role: user.role,
      tenantId: String(user.tenantId),
      tenantSlug: tenant.slug,
      username: user.username,
    });
    setAuthCookie(this.ctx, res, token);

    return { user: toAuthUser({ user, tenantSlug: tenant.slug }), token };
  }

  logout(res: Response): void {
    clearAuthCookie(this.ctx, res);
  }
}
