import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { parseContentUpload } from '../content/content-upload.parser.js';
import { ImageService } from './image.service.js';
import { updateImageSchema } from './image.validators.js';

const MAX_SIZE = 20971520;

export class ImageController {
  private readonly service: ImageService;

  constructor(ctx: AppContext) {
    this.service = new ImageService(ctx);
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
      const images = await this.service.list(this.actor(req), { lesson });
      res.json({ success: true, images });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const image = await this.service.getById(this.actor(req), req.params.id as string);
      res.json({ success: true, image });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const form = await parseContentUpload(req, {
        maxSize: MAX_SIZE,
        allowedMimePrefixes: ['image/'],
        fileFieldNames: ['file', 'image'],
        requireFile: true,
      });
      const image = await this.service.createFromUpload(this.actor(req), form);
      res.status(201).json({ success: true, image });
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
          allowedMimePrefixes: ['image/'],
          fileFieldNames: ['file', 'image'],
          requireFile: false,
        });
        const image = await this.service.updateFromUpload(
          this.actor(req),
          req.params.id as string,
          form,
        );
        res.json({ success: true, image });
        return;
      }

      const body = updateImageSchema.parse(req.body);
      const image = await this.service.update(this.actor(req), req.params.id as string, body);
      res.json({ success: true, image });
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
      const image = await this.service.markSeen(this.actor(req), req.params.id as string);
      res.json({ success: true, image });
    } catch (error) {
      next(error);
    }
  };

  file = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.pipeFile(this.actor(req), req.params.id as string, res);
    } catch (error) {
      next(error);
    }
  };
}
