import {
  createAudioProcessingQueue,
  createLogger,
  createSessionRecordingQueue,
  createVideoProcessingQueue,
  loadEnv,
  S3CompatibleStorage,
} from '@video/shared/server';
import { createServer } from 'http';
import { createApp } from './app.js';
import { initSocketServer } from './socket.js';
import { initLiveSessionRecording } from './modules/live-session/session-recording.js';
import { mongoRegistry } from './data/mongoRegistry.js';
import type { AppContext } from './types.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger('api', env.LOG_LEVEL);
  const storage = new S3CompatibleStorage(env, logger);
  const queue = createVideoProcessingQueue(env);
  const audioQueue = createAudioProcessingQueue(env);
  const sessionRecordingQueue = createSessionRecordingQueue(env);

  const ctx: AppContext = { env, logger, storage, queue, audioQueue, sessionRecordingQueue };
  initLiveSessionRecording(ctx);

  await mongoRegistry.connect(env.MONGO_URI, logger);
  await storage.ensureBucket();

  const app = createApp(ctx);
  const server = createServer(app);
  initSocketServer(server, ctx);
  
  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'API listening');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down API');
    server.close();
    await Promise.all([queue.close(), audioQueue.close(), sessionRecordingQueue.close()]);
    await mongoRegistry.disconnect(logger);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
