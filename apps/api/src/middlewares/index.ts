export {
  optionalAuth,
  requireAuth,
  requireRole,
  requireTenantAdmin,
  requireTenantOrTutor,
  requireTutor,
  signAuthToken,
  setAuthCookie,
  clearAuthCookie,
  type AuthPayload,
} from './auth.middleware.js';
export { errorHandler, notFoundHandler } from './errorHandler.middleware.js';
export {
  generalRateLimiter,
  authRateLimiter,
  uploadRateLimiter,
} from './rateLimit.middleware.js';
export { validateBody } from './validate.middleware.js';
