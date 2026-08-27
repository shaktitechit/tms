import pino from 'pino';

const redactPaths = [
  'MINIO_SECRET_KEY',
  'REDIS_PASSWORD',
  'JWT_SECRET',
  'MONGO_URI',
  'password',
  'passwordHash',
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
];

export function createLogger(name: string, level = process.env.LOG_LEVEL ?? 'info') {
  const pretty = process.env.NODE_ENV !== 'production';
  return pino({
    name,
    level,
    redact: {
      paths: redactPaths,
      censor: '[Redacted]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        }
      : {}),
  });
}

export type Logger = ReturnType<typeof createLogger>;
