import { describe, expect, it } from 'vitest';
import { User } from './server/models/User.js';
import { Tenant } from './server/models/Tenant.js';
import { Video } from './server/models/Video.js';
import { Module } from './server/models/Module.js';
import { MemberModule } from './server/models/MemberModule.js';
import { Department } from './server/models/Department.js';
import { Lesson } from './server/models/Lesson.js';
import { Discussion } from './server/models/Discussion.js';
import { VideoSeen } from './server/models/VideoSeen.js';
import { TextArea } from './server/models/TextArea.js';
import { TextAreaSeen } from './server/models/TextAreaSeen.js';
import { Audio } from './server/models/Audio.js';
import { AudioSeen } from './server/models/AudioSeen.js';
import { Image } from './server/models/Image.js';
import { ImageSeen } from './server/models/ImageSeen.js';
import { Quiz } from './server/models/Quiz.js';
import { QuizSeen } from './server/models/QuizSeen.js';
import { Pdf } from './server/models/Pdf.js';
import { PdfSeen } from './server/models/PdfSeen.js';

describe('Video model', () => {
  it('includes the required streaming fields', () => {
    const paths = Object.keys(Video.schema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        'title',
        'slug',
        'description',
        'originalFilename',
        'originalStorageKey',
        'thumbnailStorageKey',
        'hlsMasterPlaylistKey',
        'status',
        'processingProgress',
        'duration',
        'fileSize',
        'mimeType',
        'width',
        'height',
        'availableQualities',
        'visibility',
        'createdBy',
        'tenantId',
        'moduleId',
        'lessonId',
        'errorMessage',
        'createdAt',
        'updatedAt',
      ]),
    );
  });

  it('optionally belongs to a Lesson', () => {
    expect(Video.schema.path('lessonId').options.ref).toBe('Lesson');
    expect(Video.schema.path('lessonId').isRequired).toBeFalsy();
  });

  it('indexes createdBy, tenantId, status, and createdAt', () => {
    const indexes = Video.schema.indexes().map(([fields]) => fields);
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tenantId: 1, slug: 1 }),
        expect.objectContaining({ tenantId: 1, createdAt: -1 }),
        expect.objectContaining({ createdBy: 1, createdAt: -1 }),
        expect.objectContaining({ status: 1, createdAt: -1 }),
        expect.objectContaining({ createdAt: -1 }),
      ]),
    );
  });
});

describe('User model', () => {
  it('stores a hidden password hash and belongs to a tenant', () => {
    const password = User.schema.path('passwordHash');
    expect(password.options.select).toBe(false);
    expect(User.schema.path('email').options.unique).toBe(true);
    expect(User.schema.path('tenantId').options.ref).toBe('Tenant');
    expect(User.schema.path('username').isRequired).toBe(true);
  });

  it('can belong to multiple Departments', () => {
    const path = User.schema.path('departmentIds') as { instance: string; caster: { options: { ref?: string } } };
    expect(path.instance).toBe('Array');
    expect(path.caster.options.ref).toBe('Department');
  });

  it('gives user-role members learner or tutor access', () => {
    expect(User.schema.path('access').options.enum).toEqual(['learner', 'tutor']);
    expect(User.schema.path('access').options.default).toBe('learner');
  });
});

describe('Tenant model', () => {
  it('requires a unique slug', () => {
    expect(Tenant.schema.path('slug').options.unique).toBe(true);
    expect(Tenant.schema.path('name').isRequired).toBe(true);
  });

  it('includes an optional logo storage key', () => {
    expect(Object.keys(Tenant.schema.paths)).toEqual(expect.arrayContaining(['logoStorageKey']));
  });
});

describe('Module model', () => {
  it('includes tenant-scoped module fields', () => {
    const paths = Object.keys(Module.schema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        'name',
        'slug',
        'description',
        'thumbnailStorageKey',
        'authorName',
        'authorEmail',
        'createdBy',
        'tenantId',
        'departmentId',
        'createdAt',
        'updatedAt',
      ]),
    );
  });
});

describe('Department model', () => {
  it('includes tenant-scoped department fields', () => {
    const paths = Object.keys(Department.schema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        'name',
        'slug',
        'description',
        'thumbnailStorageKey',
        'createdBy',
        'tenantId',
        'createdAt',
        'updatedAt',
      ]),
    );
  });

  it('is referenced by Module.departmentId', () => {
    expect(Module.schema.path('departmentId').options.ref).toBe('Department');
  });

  it('is referenced by User.departmentIds', () => {
    const path = User.schema.path('departmentIds') as { caster: { options: { ref?: string } } };
    expect(path.caster.options.ref).toBe('Department');
  });
});

describe('Lesson model', () => {
  it('includes tenant-scoped lesson fields', () => {
    const paths = Object.keys(Lesson.schema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        'name',
        'slug',
        'description',
        'thumbnailStorageKey',
        'authorName',
        'authorEmail',
        'createdBy',
        'tenantId',
        'moduleId',
        'serial',
        'contentOrder',
        'createdAt',
        'updatedAt',
      ]),
    );
  });

  it('belongs to a Module', () => {
    expect(Lesson.schema.path('moduleId').options.ref).toBe('Module');
    expect(Lesson.schema.path('moduleId').isRequired).toBe(true);
  });
});

describe('Discussion model', () => {
  it('includes video- or lesson-scoped discussion fields', () => {
    const paths = Object.keys(Discussion.schema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        'body',
        'videoId',
        'lessonId',
        'tenantId',
        'createdBy',
        'parentId',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(Discussion.schema.path('body').isRequired).toBe(true);
    expect(Discussion.schema.path('videoId').options.ref).toBe('Video');
    expect(Discussion.schema.path('lessonId').options.ref).toBe('Lesson');
    expect(Discussion.schema.path('tenantId').options.ref).toBe('Tenant');
    expect(Discussion.schema.path('createdBy').options.ref).toBe('User');
    expect(Discussion.schema.path('parentId').options.ref).toBe('Discussion');
  });

  it('indexes tenant, video, lesson, parent, and author for listing threads', () => {
    const indexes = Discussion.schema.indexes().map(([fields]) => fields);
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tenantId: 1, videoId: 1, createdAt: -1 }),
        expect.objectContaining({ tenantId: 1, lessonId: 1, createdAt: -1 }),
        expect.objectContaining({ parentId: 1, createdAt: 1 }),
        expect.objectContaining({ createdBy: 1, createdAt: -1 }),
      ]),
    );
  });
});

describe('VideoSeen model', () => {
  it('tracks per-user seen status for a tenant video', () => {
    const paths = Object.keys(VideoSeen.schema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        'videoId',
        'userId',
        'tenantId',
        'status',
        'seenAt',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(VideoSeen.schema.path('videoId').options.ref).toBe('Video');
    expect(VideoSeen.schema.path('userId').options.ref).toBe('User');
    expect(VideoSeen.schema.path('tenantId').options.ref).toBe('Tenant');
    expect(VideoSeen.schema.path('status').options.default).toBe('PENDING');
  });

  it('uniquely indexes a viewer against a video', () => {
    const indexes = VideoSeen.schema.indexes().map(([fields]) => fields);
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 1, videoId: 1 }),
        expect.objectContaining({ tenantId: 1, userId: 1, status: 1 }),
      ]),
    );
  });
});

describe('MemberModule model', () => {
  it('assigns a tenant member to an allowed module', () => {
    const paths = Object.keys(MemberModule.schema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        'userId',
        'moduleId',
        'departmentId',
        'tenantId',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(MemberModule.schema.path('userId').options.ref).toBe('User');
    expect(MemberModule.schema.path('moduleId').options.ref).toBe('Module');
    expect(MemberModule.schema.path('departmentId').options.ref).toBe('Department');
    expect(MemberModule.schema.path('tenantId').options.ref).toBe('Tenant');
  });

  it('uniquely indexes a member against a module in a tenant', () => {
    const indexes = MemberModule.schema.indexes().map(([fields]) => fields);
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tenantId: 1, userId: 1, moduleId: 1 }),
        expect.objectContaining({ tenantId: 1, userId: 1 }),
        expect.objectContaining({ tenantId: 1, moduleId: 1 }),
      ]),
    );
  });
});

describe('Lesson content models', () => {
  it('TextArea requires lessonId and body', () => {
    expect(TextArea.schema.path('lessonId').options.ref).toBe('Lesson');
    expect(TextArea.schema.path('lessonId').isRequired).toBe(true);
    expect(TextArea.schema.path('body').isRequired).toBe(true);
    expect(Object.keys(TextArea.schema.paths)).toEqual(expect.arrayContaining(['duration']));
    expect(TextAreaSeen.schema.path('textAreaId').options.ref).toBe('TextArea');
  });

  it('Audio stores file metadata under a lesson', () => {
    const paths = Object.keys(Audio.schema.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        'title',
        'slug',
        'storageKey',
        'hlsMasterPlaylistKey',
        'status',
        'processingProgress',
        'mimeType',
        'fileSize',
        'duration',
        'availableQualities',
        'errorMessage',
        'lessonId',
        'tenantId',
      ]),
    );
    expect(Audio.schema.path('lessonId').options.ref).toBe('Lesson');
    expect(Audio.schema.path('lessonId').isRequired).toBeFalsy();
    expect(AudioSeen.schema.path('audioId').options.ref).toBe('Audio');
  });

  it('Image stores dimensions under a lesson', () => {
    expect(Image.schema.path('lessonId').options.ref).toBe('Lesson');
    expect(Image.schema.path('width')).toBeTruthy();
    expect(Image.schema.path('height')).toBeTruthy();
    expect(Image.schema.path('duration')).toBeTruthy();
    expect(ImageSeen.schema.path('imageId').options.ref).toBe('Image');
  });

  it('Quiz stores questions with correctIndex', () => {
    expect(Quiz.schema.path('lessonId').options.ref).toBe('Lesson');
    expect(Quiz.schema.path('questions')).toBeTruthy();
    const questionPaths = (Quiz.schema.path('questions') as { schema?: { paths: Record<string, unknown> } })
      .schema?.paths;
    expect(questionPaths?.duration).toBeTruthy();
    expect(QuizSeen.schema.path('quizId').options.ref).toBe('Quiz');
    expect(QuizSeen.schema.path('score')).toBeTruthy();
    expect(QuizSeen.schema.path('answers')).toBeTruthy();
    expect(QuizSeen.schema.path('attemptCount')).toBeTruthy();
  });

  it('Pdf stores pageCount under a lesson', () => {
    expect(Pdf.schema.path('lessonId').options.ref).toBe('Lesson');
    expect(Pdf.schema.path('pageCount')).toBeTruthy();
    expect(Pdf.schema.path('duration')).toBeTruthy();
    expect(PdfSeen.schema.path('pdfId').options.ref).toBe('Pdf');
  });

  it('seen models uniquely index user against content', () => {
    expect(TextAreaSeen.schema.indexes().map(([fields]) => fields)).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: 1, textAreaId: 1 })]),
    );
    expect(AudioSeen.schema.indexes().map(([fields]) => fields)).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: 1, audioId: 1 })]),
    );
    expect(ImageSeen.schema.indexes().map(([fields]) => fields)).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: 1, imageId: 1 })]),
    );
    expect(QuizSeen.schema.indexes().map(([fields]) => fields)).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: 1, quizId: 1 })]),
    );
    expect(PdfSeen.schema.indexes().map(([fields]) => fields)).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: 1, pdfId: 1 })]),
    );
  });
});
