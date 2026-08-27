import express, { type Express, type RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttpFactory from 'pino-http';
import {
  errorHandler,
  generalRateLimiter,
  notFoundHandler,
  optionalAuth,
} from './middlewares/index.js';
import { createApiRouter } from './modules/index.js';
import type { AppContext } from './types.js';

const importedPinoHttp = pinoHttpFactory as unknown as
  | ((options: Record<string, unknown>) => RequestHandler)
  | { default: (options: Record<string, unknown>) => RequestHandler };

const pinoHttp =
  typeof importedPinoHttp === 'function' ? importedPinoHttp : importedPinoHttp.default;

export function createApp(ctx: AppContext): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // HSTS on cleartext localhost can push browsers onto https:// and reject
      // the non-Secure session cookie used in local Docker / next dev.
      hsts: process.env.COOKIE_SECURE === 'true',
    }),
  );
  app.use(
    cors({
      origin: ctx.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    pinoHttp({
      logger: ctx.logger,
      autoLogging: {
        ignore: (req: { url?: string }) => req.url === '/api/health',
      },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[Redacted]',
      },
    }),
  );
  app.use(generalRateLimiter(ctx));
  app.use(optionalAuth(ctx));

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok' });
  });

  app.use('/api', createApiRouter(ctx));
  app.use(notFoundHandler);
  app.use(errorHandler(ctx));

  return app;
}
