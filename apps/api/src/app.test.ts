import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createLogger, loadEnv } from '@video/shared/server';
import { createApp } from './app.js';
import type { AppContext } from './types.js';

vi.mock('./data/mongoRegistry.js', () => ({
  mongoRegistry: {
    models: {
      Tenant: {},
      User: {
        findById: vi.fn().mockReturnValue({ lean: () => Promise.resolve(null) }),
      },
      Video: {},
      Module: {},
      MemberModule: {},
      Department: {},
      Lesson: {},
      TextArea: {},
      TextAreaSeen: {},
      Audio: {},
      AudioSeen: {},
      Image: {},
      ImageSeen: {},
      Quiz: {},
      QuizSeen: {},
      Pdf: {},
      PdfSeen: {},
      Discussion: {},
      VideoSeen: {},
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}));

function testContext(): AppContext {
  const env = loadEnv({
    NODE_ENV: 'test',
    MONGO_URI: 'mongodb://localhost:27017/test',
    REDIS_HOST: 'localhost',
    MINIO_ENDPOINT: 'localhost',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
    MINIO_BUCKET: 'contents',
    JWT_SECRET: 'test-secret-key-that-is-long',
    RATE_LIMIT_MAX: 1000,
    CORS_ORIGIN: 'http://localhost:3000',
  });
  return {
    env,
    logger: createLogger('api-test', 'silent'),
    storage: {} as AppContext['storage'],
    queue: {} as AppContext['queue'],
    audioQueue: {} as AppContext['audioQueue'],
    sessionRecordingQueue: {} as AppContext['sessionRecordingQueue'],
  };
}

describe('API HTTP surface', () => {
  const app = createApp(testContext());

  it('reports health', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, status: 'ok' });
  });

  it('returns structured 404 errors', async () => {
    const response = await request(app).get('/api/missing');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      code: 'NOT_FOUND',
    });
  });

  it('validates registration payloads', async () => {
    const response = await request(app).post('/api/auth/register').send({ email: 'bad' });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated uploads', async () => {
    const response = await request(app).post('/api/videos/tenant');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated tenant access', async () => {
    const response = await request(app).get('/api/tenants/me');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated tenant logo access', async () => {
    const response = await request(app).get('/api/tenants/me/logo');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated user listing', async () => {
    const response = await request(app).get('/api/users');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated module listing', async () => {
    const response = await request(app).get('/api/modules');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated department listing', async () => {
    const response = await request(app).get('/api/departments');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated lesson listing', async () => {
    const response = await request(app).get('/api/lessons');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated text-area listing', async () => {
    const response = await request(app).get('/api/text-areas');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated audio listing', async () => {
    const response = await request(app).get('/api/audios');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated image listing', async () => {
    const response = await request(app).get('/api/images');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated quiz listing', async () => {
    const response = await request(app).get('/api/quizzes');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated pdf listing', async () => {
    const response = await request(app).get('/api/pdfs');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated discussion listing', async () => {
    const response = await request(app).get('/api/discussions');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated seen-status updates', async () => {
    const response = await request(app).post('/api/videos/user/demo/seen');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });
});
