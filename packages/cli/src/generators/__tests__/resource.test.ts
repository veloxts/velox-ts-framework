/**
 * Resource Generator - Unit Tests
 *
 * Tests for full-stack resource generation.
 */

import { describe, expect, it } from 'vitest';

import { createResourceGenerator } from '../generators/resource.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('ResourceGenerator', () => {
  const generator = createResourceGenerator();

  // Mock project context
  const mockProject: ProjectContext = {
    hasVeloxConfig: true,
    hasPrisma: true,
    hasTsConfig: true,
    srcDir: 'src',
    isMonorepo: false,
  };

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(generator.metadata.name).toBe('resource');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('r');
      expect(generator.metadata.aliases).toContain('res');
    });

    it('should be in resource category', () => {
      expect(generator.metadata.category).toBe('resource');
    });
  });

  describe('validateOptions', () => {
    it('should return defaults optimized for full resource', () => {
      const options = generator.validateOptions({});

      expect(options.crud).toBe(true);
      expect(options.paginated).toBe(true);
      expect(options.timestamps).toBe(true);
      expect(options.softDelete).toBe(false);
      expect(options.withTests).toBe(true);
      expect(options.skipModel).toBe(false);
      expect(options.skipSchema).toBe(false);
      expect(options.skipProcedure).toBe(false);
    });

    it('should accept custom options', () => {
      const options = generator.validateOptions({
        crud: false,
        softDelete: true,
        withTests: false,
        skipModel: true,
      });

      expect(options.crud).toBe(false);
      expect(options.softDelete).toBe(true);
      expect(options.withTests).toBe(false);
      expect(options.skipModel).toBe(true);
    });
  });

  describe('generate - Full resource', () => {
    it('should generate all resource files by default', async () => {
      const config: GeneratorConfig = {
        entityName: 'post',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: false,
          withTests: true,
          skipModel: false,
          skipSchema: false,
          skipProcedure: false,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      // Should generate 4 files: model, schema, procedure, test
      expect(output.files).toHaveLength(4);

      const paths = output.files.map((f) => f.path);
      expect(paths).toContain('src/models/post.prisma');
      expect(paths).toContain('src/schemas/post.schema.ts');
      expect(paths).toContain('src/procedures/post.ts');
      expect(paths).toContain('src/procedures/__tests__/post.test.ts');
    });

    it('should skip model when skipModel is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'comment',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: false,
          withTests: true,
          skipModel: true,
          skipSchema: false,
          skipProcedure: false,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      const paths = output.files.map((f) => f.path);
      expect(paths).not.toContain('src/models/comment.prisma');
      expect(paths).toContain('src/schemas/comment.schema.ts');
    });

    it('should skip schema when skipSchema is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'tag',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: false,
          withTests: true,
          skipModel: false,
          skipSchema: true,
          skipProcedure: false,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      const paths = output.files.map((f) => f.path);
      expect(paths).toContain('src/models/tag.prisma');
      expect(paths).not.toContain('src/schemas/tag.schema.ts');
    });

    it('should skip procedure when skipProcedure is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'category',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: false,
          withTests: true,
          skipModel: false,
          skipSchema: false,
          skipProcedure: true,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      const paths = output.files.map((f) => f.path);
      expect(paths).not.toContain('src/procedures/category.ts');
      // Tests should also be skipped if procedure is skipped
      expect(paths).not.toContain('src/procedures/__tests__/category.test.ts');
    });

    it('should skip tests when withTests is false', async () => {
      const config: GeneratorConfig = {
        entityName: 'article',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: false,
          withTests: false,
          skipModel: false,
          skipSchema: false,
          skipProcedure: false,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      const paths = output.files.map((f) => f.path);
      expect(paths).not.toContain('src/procedures/__tests__/article.test.ts');
      // Should still have model, schema, and procedure
      expect(output.files).toHaveLength(3);
    });
  });

  describe('generate - Prisma model content', () => {
    it('should generate valid Prisma model', async () => {
      const config: GeneratorConfig = {
        entityName: 'user',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: false,
          withTests: false,
          skipModel: false,
          skipSchema: true,
          skipProcedure: true,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const modelFile = output.files.find((f) => f.path.endsWith('.prisma'));

      if (!modelFile) {
        throw new Error('Expected Prisma model file to be generated');
      }
      expect(modelFile.content).toContain('model User');
      expect(modelFile.content).toContain('@id @default(uuid())');
      expect(modelFile.content).toContain('createdAt DateTime');
      expect(modelFile.content).toContain('updatedAt DateTime');
      expect(modelFile.content).toContain('@@map("users")');
    });

    it('should include soft delete field when enabled', async () => {
      const config: GeneratorConfig = {
        entityName: 'order',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: true,
          withTests: false,
          skipModel: false,
          skipSchema: true,
          skipProcedure: true,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const modelFile = output.files.find((f) => f.path.endsWith('.prisma'));

      if (!modelFile) {
        throw new Error('Expected Prisma model file to be generated');
      }
      expect(modelFile.content).toContain('deletedAt DateTime?');
    });
  });

  describe('generate - Schema content', () => {
    it('should generate Zod schema with CRUD schemas', async () => {
      const config: GeneratorConfig = {
        entityName: 'product',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: false,
          withTests: false,
          skipModel: true,
          skipSchema: false,
          skipProcedure: true,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const schemaFile = output.files.find((f) => f.path.endsWith('.schema.ts'));

      if (!schemaFile) {
        throw new Error('Expected schema file to be generated');
      }
      expect(schemaFile.content).toContain('productSchema');
      expect(schemaFile.content).toContain('createProductInputSchema');
      expect(schemaFile.content).toContain('productListQuerySchema');
    });
  });

  describe('generate - Procedure content', () => {
    it('should generate CRUD procedures', async () => {
      const config: GeneratorConfig = {
        entityName: 'item',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: false,
          withTests: false,
          skipModel: true,
          skipSchema: true,
          skipProcedure: false,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const procFile = output.files.find((f) => f.path === 'src/procedures/item.ts');

      if (!procFile) {
        throw new Error('Expected procedure file to be generated');
      }
      expect(procFile.content).toContain('getItem');
      expect(procFile.content).toContain('listItems');
      expect(procFile.content).toContain('createItem');
      expect(procFile.content).toContain('updateItem');
      expect(procFile.content).toContain('deleteItem');
    });

    it('should include soft delete logic when enabled', async () => {
      const config: GeneratorConfig = {
        entityName: 'document',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: true,
          withTests: false,
          skipModel: true,
          skipSchema: true,
          skipProcedure: false,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const procFile = output.files.find(
        (f) => f.path.endsWith('.ts') && !f.path.includes('__tests__')
      );

      if (!procFile) {
        throw new Error('Expected procedure file to be generated');
      }
      expect(procFile.content).toContain('deletedAt: null');
      expect(procFile.content).toContain('deletedAt: new Date()');
    });

    it('should include pagination meta when enabled', async () => {
      const config: GeneratorConfig = {
        entityName: 'record',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: false,
          withTests: false,
          skipModel: true,
          skipSchema: true,
          skipProcedure: false,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const procFile = output.files.find((f) => f.path === 'src/procedures/record.ts');

      if (!procFile) {
        throw new Error('Expected procedure file to be generated');
      }
      expect(procFile.content).toContain('meta:');
      expect(procFile.content).toContain('totalPages');
    });
  });

  describe('generate - File naming', () => {
    it('should use kebab-case for all file names', async () => {
      const config: GeneratorConfig = {
        entityName: 'UserProfile',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: false,
          withTests: true,
          skipModel: false,
          skipSchema: false,
          skipProcedure: false,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      const paths = output.files.map((f) => f.path);
      expect(paths).toContain('src/models/user-profile.prisma');
      expect(paths).toContain('src/schemas/user-profile.schema.ts');
      expect(paths).toContain('src/procedures/user-profile.ts');
      expect(paths).toContain('src/procedures/__tests__/user-profile.test.ts');
    });
  });

  describe('generate - Post instructions', () => {
    it('should include helpful next steps', async () => {
      const config: GeneratorConfig = {
        entityName: 'post',
        options: {
          crud: true,
          paginated: true,
          timestamps: true,
          softDelete: false,
          withTests: true,
          skipModel: false,
          skipSchema: false,
          skipProcedure: false,
        },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('prisma');
      expect(output.postInstructions).toContain('router');
      expect(output.postInstructions).toContain('API');
    });
  });
});
