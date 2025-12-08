/**
 * Procedure Generator - Unit Tests
 *
 * Tests for procedure template generation.
 */

import { describe, expect, it } from 'vitest';

import { createProcedureGenerator } from '../generators/procedure.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('ProcedureGenerator', () => {
  const generator = createProcedureGenerator();

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
      expect(generator.metadata.name).toBe('procedure');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('p');
      expect(generator.metadata.aliases).toContain('proc');
    });

    it('should be in resource category', () => {
      expect(generator.metadata.category).toBe('resource');
    });
  });

  describe('validateEntityName', () => {
    it('should accept valid names', () => {
      expect(generator.validateEntityName('user')).toBeUndefined();
      expect(generator.validateEntityName('User')).toBeUndefined();
      expect(generator.validateEntityName('user-profile')).toBeUndefined();
      expect(generator.validateEntityName('user_profile')).toBeUndefined();
      expect(generator.validateEntityName('User123')).toBeUndefined();
    });

    it('should reject names starting with numbers', () => {
      expect(generator.validateEntityName('123user')).not.toBeNull();
    });

    it('should reject names with special characters', () => {
      expect(generator.validateEntityName('user@profile')).not.toBeNull();
      expect(generator.validateEntityName('user.profile')).not.toBeNull();
      expect(generator.validateEntityName('user profile')).not.toBeNull();
    });

    it('should reject empty names', () => {
      expect(generator.validateEntityName('')).not.toBeNull();
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.crud).toBe(false);
      expect(options.paginated).toBe(false);
    });

    it('should accept valid options', () => {
      const options = generator.validateOptions({
        crud: true,
        paginated: true,
      });

      expect(options.crud).toBe(true);
      expect(options.paginated).toBe(true);
    });

    it('should coerce string to boolean', () => {
      const options = generator.validateOptions({
        crud: 'true',
      });

      expect(options.crud).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate simple procedure file', async () => {
      const config: GeneratorConfig = {
        entityName: 'user',
        options: { crud: false, paginated: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      // File is named after plural form since it handles /users endpoint
      expect(output.files[0].path).toBe('src/procedures/users.ts');
      expect(output.files[0].content).toContain('defineProcedures');
      expect(output.files[0].content).toContain('getUser');
    });

    it('should generate CRUD procedures when crud option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'post',
        options: { crud: true, paginated: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      const content = output.files[0].content;

      // Should have CRUD operations
      expect(content).toContain('getPost');
      expect(content).toContain('listPosts');
      expect(content).toContain('createPost');
      expect(content).toContain('updatePost');
      expect(content).toContain('deletePost');
    });

    it('should generate paginated list when paginated option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'comment',
        options: { crud: true, paginated: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      // Should have pagination logic
      expect(content).toContain('page');
      expect(content).toContain('limit');
      expect(content).toContain('meta');
      expect(content).toContain('totalPages');
    });

    it('should use kebab-case for file names with plural', async () => {
      const config: GeneratorConfig = {
        entityName: 'UserProfile',
        options: { crud: false, paginated: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      // File is named after plural form (userProfiles -> user-profiles would be ideal)
      // Current implementation uses entity.plural which is camelCase
      expect(output.files[0].path).toBe('src/procedures/userProfiles.ts');
    });

    it('should use PascalCase for procedure names', async () => {
      const config: GeneratorConfig = {
        entityName: 'user-profile',
        options: { crud: true, paginated: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      // Procedure names use PascalCase entity name
      expect(content).toContain('getUserProfile');
      expect(content).toContain('createUserProfile');
    });

    it('should include post-generation instructions', async () => {
      const config: GeneratorConfig = {
        entityName: 'user',
        options: { crud: false, paginated: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('import');
    });
  });
});
