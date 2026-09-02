import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../../http/errors.js';
import type { AppContext } from '../../types.js';
import { StreamService } from './stream.service.js';
import { parseVideoUpload } from './upload.parser.js';
import { VideoService } from './video.service.js';

export class VideoController {
  private readonly videos: VideoService;
  private readonly streams: StreamService;

  constructor(private readonly ctx: AppContext) {
    this.videos = new VideoService(ctx);
    this.streams = new StreamService(ctx);
  }

  private actor(req: Request) {
    if (!req.user) {
      throw unauthorized();
    }
    return req.user;
  }

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.actor(req);
      const parsed = await parseVideoUpload(req, this.ctx);
      const video = await this.videos.createFromUpload({
        userId: user.id,
        tenantId: user.tenantId,
        title: parsed.title,
        description: parsed.description,
        visibility: parsed.visibility,
        moduleId: parsed.moduleId,
        lessonId: parsed.lessonId,
        originalFilename: parsed.filename,
        mimeType: parsed.mimeType,
        fileSize: parsed.size,
        body: parsed.stream,
      });
      res.status(201).json({
        success: true,
        video: {
          id: video.id,
          slug: video.slug,
          status: video.status,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  uploadYoutube = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = this.actor(req);
      const video = await this.videos.createFromYoutube({
        userId: user.id,
        tenantId: user.tenantId,
        youtubeUrl: req.body.youtubeUrl,
        title: req.body.title,
        description: req.body.description,
        visibility: req.body.visibility,
        moduleId: req.body.moduleId,
        lessonId: req.body.lessonId,
      });
      res.status(201).json({
        success: true,
        video,
      });
    } catch (error) {
      next(error);
    }
  };

  listPublic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const videos = await this.videos.listPublic(status);
      res.json({ success: true, videos });
    } catch (error) {
      next(error);
    }
  };

  listTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const moduleRef = typeof req.query.module === 'string' ? req.query.module : undefined;
      const lessonRef = typeof req.query.lesson === 'string' ? req.query.lesson : undefined;
      const videos = await this.videos.listForTenant(this.actor(req), {
        status,
        module: moduleRef,
        lesson: lessonRef,
      });
      res.json({ success: true, videos });
    } catch (error) {
      next(error);
    }
  };

  listUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const moduleRef = typeof req.query.module === 'string' ? req.query.module : undefined;
      const lessonRef = typeof req.query.lesson === 'string' ? req.query.lesson : undefined;
      const videos = await this.videos.listForUser(this.actor(req), {
        status,
        module: moduleRef,
        lesson: lessonRef,
      });
      res.json({ success: true, videos });
    } catch (error) {
      next(error);
    }
  };

  getPublic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dto } = await this.videos.getById(req.params.id as string, req.user);
      res.json({ success: true, video: dto });
    } catch (error) {
      next(error);
    }
  };

  getTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dto } = await this.videos.getForTenant(req.params.id as string, this.actor(req));
      res.json({ success: true, video: dto });
    } catch (error) {
      next(error);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dto } = await this.videos.getForUser(req.params.id as string, this.actor(req));
      res.json({ success: true, video: dto });
    } catch (error) {
      next(error);
    }
  };

  statusPublic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = await this.videos.getStatus(req.params.id as string, req.user);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  };

  statusTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = await this.videos.getStatusForTenant(
        req.params.id as string,
        this.actor(req),
      );
      res.json(payload);
    } catch (error) {
      next(error);
    }
  };

  statusUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = await this.videos.getStatusForUser(
        req.params.id as string,
        this.actor(req),
      );
      res.json(payload);
    } catch (error) {
      next(error);
    }
  };

  updateTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const video = await this.videos.updateForTenant(
        req.params.id as string,
        this.actor(req),
        req.body,
      );
      res.json({ success: true, video });
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const video = await this.videos.updateForUser(
        req.params.id as string,
        this.actor(req),
        req.body,
      );
      res.json({ success: true, video });
    } catch (error) {
      next(error);
    }
  };

  markSeenTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const video = await this.videos.markSeenForTenant(req.params.id as string, this.actor(req));
      res.json({ success: true, video });
    } catch (error) {
      next(error);
    }
  };

  markSeenUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const video = await this.videos.markSeenForUser(req.params.id as string, this.actor(req));
      res.json({ success: true, video });
    } catch (error) {
      next(error);
    }
  };

  removeTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.videos.deleteForTenant(req.params.id as string, this.actor(req));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  removeUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.videos.deleteForUser(req.params.id as string, this.actor(req));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  stream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const info = await this.streams.streamInfo(req.params.id as string, req.user);
      res.json({ success: true, stream: info });
    } catch (error) {
      next(error);
    }
  };

  hls = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const marker = '/hls/';
      const idx = req.path.indexOf(marker);
      const assetPath = idx >= 0 ? req.path.slice(idx + marker.length) : '';
      await this.streams.pipeHls(req, res, id, assetPath);
    } catch (error) {
      next(error);
    }
  };

  thumbnail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.streams.pipeThumbnail(req, res, req.params.id as string);
    } catch (error) {
      next(error);
    }
  };

  original = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.streams.pipeOriginal(req, res, req.params.id as string);
    } catch (error) {
      next(error);
    }
  };
}
