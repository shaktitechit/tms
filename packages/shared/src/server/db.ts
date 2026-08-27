import mongoose from 'mongoose';
import type { Logger } from './logger.js';

export async function connectMongo(uri: string, logger: Logger): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info('Connected to MongoDB');
  return mongoose;
}

export async function disconnectMongo(logger?: Logger): Promise<void> {
  await mongoose.disconnect();
  logger?.info('Disconnected from MongoDB');
}
