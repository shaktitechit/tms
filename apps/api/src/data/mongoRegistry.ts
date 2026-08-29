import { connectMongo, disconnectMongo, type Logger } from '@video/shared/server';
import {
  Audio,
  AudioSeen,
  Department,
  Discussion,
  Image,
  ImageSeen,
  Lesson,
  MemberModule,
  Module,
  Pdf,
  PdfSeen,
  Quiz,
  QuizSeen,
  TextArea,
  TextAreaSeen,
  Tenant,
  User,
  Video,
  VideoSeen,
  LiveSession,
  LiveChatMessage,
} from '../models/index.js';

/**
 * Central Mongo access point: connection lifecycle + registered models.
 */
export const mongoRegistry = {
  models: {
    Tenant,
    User,
    Video,
    Module,
    MemberModule,
    Department,
    Lesson,
    TextArea,
    TextAreaSeen,
    Audio,
    AudioSeen,
    Image,
    ImageSeen,
    Quiz,
    QuizSeen,
    Pdf,
    PdfSeen,
    Discussion,
    VideoSeen,
    LiveSession,
    LiveChatMessage,
  } as const,

  async connect(uri: string, logger: Logger) {
    return connectMongo(uri, logger);
  },

  async disconnect(logger?: Logger) {
    return disconnectMongo(logger);
  },
};

export type MongoModels = typeof mongoRegistry.models;
