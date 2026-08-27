import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { parseContentUpload } from '../content/content-upload.parser.js';
import { AudioStreamService } from './audio-stream.service.js';
import { AudioService } from './audio.service.js';
import { updateAudioSchema } from './audio.validators.js';

const MAX_SIZE = 209715200;

export class AudioController {
  private readonly service: AudioService;
  private readonly streams: AudioStreamService;

  constructor(ctx: AppContext) {
    this.service = new AudioService(ctx);
    this.streams = new AudioStreamService(ctx);
  }

  private actor(req: Request) {
    if (!req.user) {
      throw unauthorized();
    }
    return req.user;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lesson = typeof req.query.lesson === 'string' ? req.query.lesson : undefined;
      const audios = await this.service.list(this.actor(req), { lesson });
      res.json({ success: true, audios });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const audio = await this.service.getById(this.actor(req), req.params.id as string);
      res.json({ success: true, audio });
    } catch (error) {
      next(error);
    }
  };

  status = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = await this.service.getStatus(this.actor(req), req.params.id as string);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const form = await parseContentUpload(req, {
        maxSize: MAX_SIZE,
        allowedMimePrefixes: ['audio/'],
        fileFieldNames: ['file', 'audio'],
        requireFile: true,
      });
      const audio = await this.service.createFromUpload(this.actor(req), form);
      res.status(201).json({ success: true, audio });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contentType = req.headers['content-type'] ?? '';
      if (contentType.includes('multipart/form-data')) {
        const form = await parseContentUpload(req, {
          maxSize: MAX_SIZE,
          allowedMimePrefixes: ['audio/'],
          fileFieldNames: ['file', 'audio'],
          requireFile: false,
        });
        const audio = await this.service.updateFromUpload(
          this.actor(req),
          req.params.id as string,
          form,
        );
        res.json({ success: true, audio });
        return;
      }

      const body = updateAudioSchema.parse(req.body);
      const audio = await this.service.update(this.actor(req), req.params.id as string, body);
      res.json({ success: true, audio });
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.remove(this.actor(req), req.params.id as string);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  markSeen = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const audio = await this.service.markSeen(this.actor(req), req.params.id as string);
      res.json({ success: true, audio });
    } catch (error) {
      next(error);
    }
  };

  stream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.pipeStream(this.actor(req), req.params.id as string, req, res);
    } catch (error) {
      next(error);
    }
  };

  file = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.pipeFile(this.actor(req), req.params.id as string, req, res);
    } catch (error) {
      next(error);
    }
  };

  hls = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = this.actor(req);
      const id = req.params.id as string;
      const marker = '/hls/';
      const idx = req.path.indexOf(marker);
      const assetPath = idx >= 0 ? req.path.slice(idx + marker.length) : '';
      await this.streams.pipeHls(req, res, id, assetPath, actor.tenantId);
    } catch (error) {
      next(error);
    }
  };
}
