/**
 * Guard Generator - Unit Tests
 *
 * Tests for auth guard template generation.
 */

import { describe, expect, it } from 'vitest';

import { createGuardGenerator } from '../generators/guard.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('GuardGenerator', () => {
  const generator = createGuardGenerator();

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
      expect(generator.metadata.name).toBe('guard');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('g');
      expect(generator.metadata.aliases).toContain('grd');
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
      expect(generator.validateEntityName('subscriber')).toBeUndefined();
      expect(generator.validateEntityName('admin-access')).toBeUndefined();
      expect(generator.validateEntityName('PremiumUser')).toBeUndefined();
    });

    it('should reject invalid names', () => {
      expect(generator.validateEntityName('')).toBeDefined();
      expect(generator.validateEntityName('123guard')).toBeDefined();
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.role).toBe(false);
      expect(options.permission).toBe(false);
      expect(options.ownership).toBe(false);
      expect(options.composite).toBe(false);
    });

    it('should accept role option', () => {
      const options = generator.validateOptions({ role: true });
      expect(options.role).toBe(true);
    });

    it('should accept permission option', () => {
      const options = generator.validateOptions({ permission: true });
      expect(options.permission).toBe(true);
    });

    it('should accept owner option (maps to ownership)', () => {
      const options = generator.validateOptions({ owner: true });
      expect(options.ownership).toBe(true);
    });

    it('should accept composite option', () => {
      const options = generator.validateOptions({ composite: true });
      expect(options.composite).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate simple guard file', async () => {
      const config: GeneratorConfig = {
        entityName: 'subscriber',
        options: { role: false, permission: false, ownership: false, composite: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/guards/subscriber.ts');
      expect(output.files[0].content).toContain('subscriberGuard');
      expect(output.files[0].content).toContain('BaseContext');
      expect(output.files[0].content).toContain('Guard');
    });

    it('should generate role-based guard when role option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'admin',
        options: { role: true, permission: false, ownership: false, composite: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('hasRole');
      expect(content).toContain('isAdmin');
      expect(content).toContain('requireRole');
      expect(content).toContain('requireAnyRole');
      expect(content).toContain('requireAllRoles');
    });

    it('should generate permission-based guard when permission option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'post',
        options: { role: false, permission: true, ownership: false, composite: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('PostPermissions');
      expect(content).toContain('hasPermission');
      expect(content).toContain('canReadPost');
      expect(content).toContain('canCreatePost');
      expect(content).toContain('canUpdatePost');
      expect(content).toContain('canDeletePost');
    });

    it('should generate ownership guard when owner option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'document',
        options: { role: false, permission: false, ownership: true, composite: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('createOwnershipGuard');
      expect(content).toContain('ownsDocument');
      expect(content).toContain('authenticatedOwner');
      expect(content).toContain('ownerOrRole');
    });

    it('should generate composite guard when composite option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'access',
        options: { role: false, permission: false, ownership: false, composite: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('when');
      expect(content).toContain('requireN');
      expect(content).toContain('AccessGuards');
      expect(content).toContain('duringHours');
      expect(content).toContain('underRateLimit');
      expect(content).toContain('featureEnabled');
    });

    it('should include post-generation instructions', async () => {
      const config: GeneratorConfig = {
        entityName: 'custom',
        options: { role: false, permission: false, ownership: false, composite: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('guard');
      expect(output.postInstructions).toContain('procedure');
    });
  });
});
