/**
 * Policy Generator - Unit Tests
 *
 * Tests for authorization policy template generation.
 */

import { describe, expect, it } from 'vitest';

import { createPolicyGenerator } from '../generators/policy.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('PolicyGenerator', () => {
  const generator = createPolicyGenerator();

  // Mock project context
  const mockProject: ProjectContext = {
    name: 'test-app',
    hasAuth: true,
    database: 'sqlite',
    projectType: 'api',
    isVinxiProject: false,
    hasWeb: false,
  };

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(generator.metadata.name).toBe('policy');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('pol');
      expect(generator.metadata.aliases).toContain('auth');
    });

    it('should be in auth category', () => {
      expect(generator.metadata.category).toBe('auth');
    });

    it('should have description', () => {
      expect(generator.metadata.description).toBeTruthy();
    });
  });

  describe('validateEntityName', () => {
    it('should accept valid names', () => {
      expect(generator.validateEntityName('post')).toBeUndefined();
      expect(generator.validateEntityName('user-profile')).toBeUndefined();
      expect(generator.validateEntityName('Document')).toBeUndefined();
    });

    it('should reject invalid names', () => {
      expect(generator.validateEntityName('')).toBeDefined();
      expect(generator.validateEntityName('123policy')).toBeDefined();
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.crud).toBe(false);
      expect(options.resource).toBe(false);
      expect(options.softDelete).toBe(false);
    });

    it('should accept crud option', () => {
      const options = generator.validateOptions({ crud: true });
      expect(options.crud).toBe(true);
    });

    it('should accept resource option', () => {
      const options = generator.validateOptions({ resource: true });
      expect(options.resource).toBe(true);
    });

    it('should accept soft option (maps to softDelete)', () => {
      const options = generator.validateOptions({ soft: true });
      expect(options.softDelete).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate simple policy file', async () => {
      const config: GeneratorConfig = {
        entityName: 'post',
        options: { crud: false, resource: false, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/policies/post.ts');
      expect(output.files[0].content).toContain('canViewPost');
      expect(output.files[0].content).toContain('canCreatePost');
      expect(output.files[0].content).toContain('canUpdatePost');
      expect(output.files[0].content).toContain('canDeletePost');
      expect(output.files[0].content).toContain('postGuard');
    });

    it('should generate CRUD policy class when crud option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'article',
        options: { crud: true, resource: false, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('class ArticlePolicy');
      expect(content).toContain('viewAny');
      expect(content).toContain('view');
      expect(content).toContain('create');
      expect(content).toContain('update');
      expect(content).toContain('delete');
      expect(content).toContain('articlePolicy');
    });

    it('should include soft delete methods when soft option is true with crud', async () => {
      const config: GeneratorConfig = {
        entityName: 'comment',
        options: { crud: true, resource: false, softDelete: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('restore');
      expect(content).toContain('forceDelete');
    });

    it('should generate resource-based ABAC policy when resource option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'document',
        options: { crud: false, resource: true, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('PolicyRule');
      expect(content).toContain('documentRules');
      expect(content).toContain('canDocument');
      expect(content).toContain('allowedDocumentActions');
      expect(content).toContain('assertDocument');
      expect(content).toContain('visibility');
      expect(content).toContain('status');
    });

    it('should include post-generation instructions', async () => {
      const config: GeneratorConfig = {
        entityName: 'custom',
        options: { crud: false, resource: false, softDelete: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('policy');
      expect(output.postInstructions).toContain('procedure');
    });
  });
});
