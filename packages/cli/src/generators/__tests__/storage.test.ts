/**
 * Storage Generator - Unit Tests
 *
 * Tests for storage configuration and upload handler generation.
 */

import { describe, expect, it } from 'vitest';

import { createStorageGenerator } from '../generators/storage.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('StorageGenerator', () => {
  const generator = createStorageGenerator();

  // Mock project context
  const mockProject: ProjectContext = {
    name: 'test-app',
    hasAuth: false,
    database: 'sqlite',
    projectType: 'api',
    isVinxiProject: false,
    hasWeb: false,
  };

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(generator.metadata.name).toBe('storage');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('st');
      expect(generator.metadata.aliases).toContain('store');
    });

    it('should be in infrastructure category', () => {
      expect(generator.metadata.category).toBe('infrastructure');
    });

    it('should have description', () => {
      expect(generator.metadata.description).toBeTruthy();
    });
  });

  describe('validateEntityName', () => {
    it('should accept valid names', () => {
      expect(generator.validateEntityName('avatar')).toBeUndefined();
      expect(generator.validateEntityName('document')).toBeUndefined();
      expect(generator.validateEntityName('FileUpload')).toBeUndefined();
    });

    it('should reject invalid names', () => {
      expect(generator.validateEntityName('')).toBeDefined();
      expect(generator.validateEntityName('123storage')).toBeDefined();
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.local).toBe(false);
      expect(options.s3).toBe(false);
      expect(options.upload).toBe(false);
    });

    it('should accept local option', () => {
      const options = generator.validateOptions({ local: true });
      expect(options.local).toBe(true);
      expect(options.s3).toBe(false);
      expect(options.upload).toBe(false);
    });

    it('should accept s3 option', () => {
      const options = generator.validateOptions({ s3: true });
      expect(options.s3).toBe(true);
      expect(options.local).toBe(false);
      expect(options.upload).toBe(false);
    });

    it('should accept upload option', () => {
      const options = generator.validateOptions({ upload: true });
      expect(options.upload).toBe(true);
      expect(options.local).toBe(false);
      expect(options.s3).toBe(false);
    });

    it('should throw error for mutually exclusive options', () => {
      expect(() => generator.validateOptions({ local: true, s3: true })).toThrow(
        'mutually exclusive'
      );

      expect(() => generator.validateOptions({ s3: true, upload: true })).toThrow(
        'mutually exclusive'
      );

      expect(() => generator.validateOptions({ local: true, upload: true })).toThrow(
        'mutually exclusive'
      );
    });
  });

  describe('generate', () => {
    it('should generate local storage configuration by default', async () => {
      const config: GeneratorConfig = {
        entityName: 'avatar',
        options: { local: false, s3: false, upload: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/config/storage/avatar.ts');
      expect(output.files[0].content).toContain('avatarStorage');
      expect(output.files[0].content).toContain('createLocalStorageDriver');
      expect(output.files[0].content).toContain('Local Filesystem');
      expect(output.files[0].content).toContain('Avatar Storage Configuration');
    });

    it('should generate local storage configuration when local option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'document',
        options: { local: true, s3: false, upload: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('createLocalStorageDriver');
      expect(content).toContain("root: join(process.cwd(), 'storage', 'document')");
      expect(content).toContain('visibility:');
      expect(content).toContain('permissions:');
      expect(content).toContain('pathGenerator:');
    });

    it('should generate S3 storage configuration when s3 option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'media',
        options: { local: false, s3: true, upload: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(output.files[0].path).toBe('src/config/storage/media.ts');
      expect(content).toContain('createS3StorageDriver');
      expect(content).toContain('S3/R2/MinIO');
      expect(content).toContain('credentials:');
      expect(content).toContain('accessKeyId:');
      expect(content).toContain('secretAccessKey:');
      expect(content).toContain('bucket:');
      expect(content).toContain('region:');
      expect(content).toContain('S3_ACCESS_KEY_ID');
    });

    it('should generate upload handler when upload option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'file',
        options: { local: false, s3: false, upload: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(output.files[0].path).toBe('src/handlers/file-upload.ts');
      expect(content).toContain('Upload Handler');
      expect(content).toContain('uploadFile');
      expect(content).toContain('deleteFile');
      expect(content).toContain('downloadFile');
      expect(content).toContain('procedure');
      expect(content).toContain('multipart');
    });

    it('should include helper functions in local storage', async () => {
      const config: GeneratorConfig = {
        entityName: 'avatar',
        options: { local: true, s3: false, upload: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('generateUniqueFilename');
      expect(content).toContain('validateAvatarFile');
      expect(content).toContain('timestamp');
      expect(content).toContain('allowedTypes');
      expect(content).toContain('maxSize');
    });

    it('should include S3-specific helpers when s3 option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'document',
        options: { local: false, s3: true, upload: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('generateS3Key');
      expect(content).toContain('validateDocumentFile');
      expect(content).toContain('getContentType');
      expect(content).toContain('getSignedUrl');
    });

    it('should use kebab-case for storage names', async () => {
      const config: GeneratorConfig = {
        entityName: 'UserAvatar',
        options: { local: true, s3: false, upload: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files[0].path).toBe('src/config/storage/useravatar.ts');
    });

    it('should include validation schemas in upload handler', async () => {
      const config: GeneratorConfig = {
        entityName: 'image',
        options: { local: false, s3: false, upload: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain("import { z } from 'zod'");
      expect(content).toContain('UploadImageSchema');
      expect(content).toContain('UploadImageResponseSchema');
      expect(content).toContain('DeleteImageSchema');
      expect(content).toContain('DownloadImageSchema');
    });

    it('should include multipart handling in upload handler', async () => {
      const config: GeneratorConfig = {
        entityName: 'file',
        options: { local: false, s3: false, upload: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('ctx.request.file()');
      expect(content).toContain('data.mimetype');
      expect(content).toContain('toBuffer()');
      expect(content).toContain('@fastify/multipart');
    });

    it('should include post-generation instructions', async () => {
      const config: GeneratorConfig = {
        entityName: 'avatar',
        options: { local: true, s3: false, upload: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('storage');
      expect(output.postInstructions).toContain('Next steps');
    });

    it('should include local-specific instructions for local storage', async () => {
      const config: GeneratorConfig = {
        entityName: 'avatar',
        options: { local: true, s3: false, upload: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toContain('storage directory');
      expect(output.postInstructions).toContain('.gitignore');
      expect(output.postInstructions).toContain('fastifyStatic');
    });

    it('should include S3-specific instructions for s3 storage', async () => {
      const config: GeneratorConfig = {
        entityName: 'document',
        options: { local: false, s3: true, upload: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toContain('S3_ACCESS_KEY_ID');
      expect(output.postInstructions).toContain('S3_SECRET_ACCESS_KEY');
      expect(output.postInstructions).toContain('@aws-sdk/client-s3');
      expect(output.postInstructions).toContain('pnpm add');
    });

    it('should include upload-specific instructions for upload handler', async () => {
      const config: GeneratorConfig = {
        entityName: 'file',
        options: { local: false, s3: false, upload: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toContain('@fastify/multipart');
      expect(output.postInstructions).toContain('app.register(multipart)');
      expect(output.postInstructions).toContain('velox make storage');
    });

    it('should generate PascalCase type names', async () => {
      const config: GeneratorConfig = {
        entityName: 'user-avatar',
        options: { local: true, s3: false, upload: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('userAvatarStorage');
      expect(content).toContain('validateUserAvatarFile');
      expect(content).toContain('UserAvatar Storage Configuration');
    });

    it('should generate camelCase variable names', async () => {
      const config: GeneratorConfig = {
        entityName: 'ProfileImage',
        options: { local: true, s3: false, upload: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('profileImageStorage');
    });
  });
});
