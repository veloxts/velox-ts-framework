/**
 * Schema Generator - Unit Tests
 *
 * Tests for Zod schema template generation.
 */

import { describe, expect, it } from 'vitest';

import { createSchemaGenerator } from '../generators/schema.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('SchemaGenerator', () => {
  const generator = createSchemaGenerator();

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
      expect(generator.metadata.name).toBe('schema');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('s');
      expect(generator.metadata.aliases).toContain('zod');
    });

    it('should be in resource category', () => {
      expect(generator.metadata.category).toBe('resource');
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.crud).toBe(false);
      expect(options.timestamps).toBe(true);
      expect(options.softDelete).toBe(false);
    });

    it('should accept valid options', () => {
      const options = generator.validateOptions({
        crud: true,
        timestamps: false,
        softDelete: true,
      });

      expect(options.crud).toBe(true);
      expect(options.timestamps).toBe(false);
      expect(options.softDelete).toBe(true);
    });
  });

  describe('generate - Basic schema', () => {
    it('should generate base schema file', async () => {
      const config: GeneratorConfig = {
        entityName: 'user',
        options: { crud: false, timestamps: true, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/schemas/user.schema.ts');

      const content = output.files[0].content;
      expect(content).toContain("import { z } from 'zod'");
      expect(content).toContain('userSchema');
      expect(content).toContain('z.object');
      expect(content).toContain('id: z.string().uuid()');
    });

    it('should include timestamp fields when enabled', async () => {
      const config: GeneratorConfig = {
        entityName: 'post',
        options: { crud: false, timestamps: true, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('createdAt: z.date()');
      expect(content).toContain('updatedAt: z.date()');
    });

    it('should exclude timestamp fields when disabled', async () => {
      const config: GeneratorConfig = {
        entityName: 'tag',
        options: { crud: false, timestamps: false, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).not.toContain('createdAt');
      expect(content).not.toContain('updatedAt');
    });

    it('should include soft delete field when enabled', async () => {
      const config: GeneratorConfig = {
        entityName: 'comment',
        options: { crud: false, timestamps: true, softDelete: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('deletedAt: z.date().nullable()');
    });
  });

  describe('generate - CRUD schemas', () => {
    it('should generate CRUD schemas when enabled', async () => {
      const config: GeneratorConfig = {
        entityName: 'product',
        options: { crud: true, timestamps: true, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      // Should have input schemas
      expect(content).toContain('createProductInputSchema');
      expect(content).toContain('updateProductInputSchema');
      expect(content).toContain('patchProductInputSchema');

      // Should have query schemas
      expect(content).toContain('productIdParamSchema');
      expect(content).toContain('productListQuerySchema');

      // Should have response schemas
      expect(content).toContain('productResponseSchema');
      expect(content).toContain('productListResponseSchema');
    });

    it('should omit auto-generated fields in input schemas', async () => {
      const config: GeneratorConfig = {
        entityName: 'order',
        options: { crud: true, timestamps: true, softDelete: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      // Should omit id, timestamps, and softDelete in create schema
      expect(content).toContain('id: true');
      expect(content).toContain('createdAt: true');
      expect(content).toContain('updatedAt: true');
      expect(content).toContain('deletedAt: true');
    });

    it('should make patch schema partial', async () => {
      const config: GeneratorConfig = {
        entityName: 'category',
        options: { crud: true, timestamps: true, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('updateCategoryInputSchema.partial()');
    });

    it('should include pagination in list query schema', async () => {
      const config: GeneratorConfig = {
        entityName: 'item',
        options: { crud: true, timestamps: true, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('page:');
      expect(content).toContain('limit:');
      expect(content).toContain('sortBy:');
      expect(content).toContain('sortOrder:');
      expect(content).toContain('search:');
    });

    it('should include meta in list response schema', async () => {
      const config: GeneratorConfig = {
        entityName: 'article',
        options: { crud: true, timestamps: true, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('meta: z.object');
      expect(content).toContain('total:');
      expect(content).toContain('totalPages:');
    });
  });

  describe('generate - File naming', () => {
    it('should use kebab-case for file names', async () => {
      const config: GeneratorConfig = {
        entityName: 'UserProfile',
        options: { crud: false, timestamps: true, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files[0].path).toBe('src/schemas/user-profile.schema.ts');
    });

    it('should use camelCase for schema variable names', async () => {
      const config: GeneratorConfig = {
        entityName: 'blog-post',
        options: { crud: false, timestamps: true, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('blogPostSchema');
    });

    it('should use PascalCase for type names', async () => {
      const config: GeneratorConfig = {
        entityName: 'order_item',
        options: { crud: true, timestamps: true, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('type OrderItem =');
      expect(content).toContain('CreateOrderItemInput');
      expect(content).toContain('UpdateOrderItemInput');
    });
  });

  describe('generate - Type exports', () => {
    it('should export inferred types', async () => {
      const config: GeneratorConfig = {
        entityName: 'user',
        options: { crud: true, timestamps: true, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('export type User = z.infer<typeof userSchema>');
      expect(content).toContain(
        'export type CreateUserInput = z.infer<typeof createUserInputSchema>'
      );
      expect(content).toContain(
        'export type UserListResponse = z.infer<typeof userListResponseSchema>'
      );
    });
  });
});
