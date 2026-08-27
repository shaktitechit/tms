import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { parseContentUpload } from '../content/content-upload.parser.js';
import { PdfService } from './pdf.service.js';
import { updatePdfSchema } from './pdf.validators.js';

const MAX_SIZE = 52428800;

export class PdfController {
  private readonly service: PdfService;

  constructor(ctx: AppContext) {
    this.service = new PdfService(ctx);
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
      const pdfs = await this.service.list(this.actor(req), { lesson });
      res.json({ success: true, pdfs });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pdf = await this.service.getById(this.actor(req), req.params.id as string);
      res.json({ success: true, pdf });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const form = await parseContentUpload(req, {
        maxSize: MAX_SIZE,
        allowedMimeTypes: ['application/pdf'],
        fileFieldNames: ['file', 'pdf'],
        requireFile: true,
      });
      const pdf = await this.service.createFromUpload(this.actor(req), form);
      res.status(201).json({ success: true, pdf });
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
          allowedMimeTypes: ['application/pdf'],
          fileFieldNames: ['file', 'pdf'],
          requireFile: false,
        });
        const pdf = await this.service.updateFromUpload(
          this.actor(req),
          req.params.id as string,
          form,
        );
        res.json({ success: true, pdf });
        return;
      }

      const body = updatePdfSchema.parse(req.body);
      const pdf = await this.service.update(this.actor(req), req.params.id as string, body);
      res.json({ success: true, pdf });
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
      const pdf = await this.service.markSeen(this.actor(req), req.params.id as string);
      res.json({ success: true, pdf });
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
