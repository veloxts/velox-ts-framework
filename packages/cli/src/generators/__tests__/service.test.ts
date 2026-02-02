/**
 * Service Generator - Unit Tests
 *
 * Tests for service class template generation.
 */

import { describe, expect, it } from 'vitest';

import { createServiceGenerator } from '../generators/service.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('ServiceGenerator', () => {
  const generator = createServiceGenerator();

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
      expect(generator.metadata.name).toBe('service');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('svc');
      expect(generator.metadata.aliases).toContain('srv');
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
      expect(generator.validateEntityName('payment')).toBeUndefined();
      expect(generator.validateEntityName('user-notification')).toBeUndefined();
      expect(generator.validateEntityName('EmailService')).toBeUndefined();
    });

    it('should reject invalid names', () => {
      expect(generator.validateEntityName('')).toBeDefined();
      expect(generator.validateEntityName('123service')).toBeDefined();
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.crud).toBe(false);
      expect(options.cache).toBe(false);
      expect(options.events).toBe(false);
    });

    it('should accept crud option', () => {
      const options = generator.validateOptions({ crud: true });
      expect(options.crud).toBe(true);
    });

    it('should accept cache option', () => {
      const options = generator.validateOptions({ cache: true });
      expect(options.cache).toBe(true);
    });

    it('should accept events option', () => {
      const options = generator.validateOptions({ events: true });
      expect(options.events).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate simple service file', async () => {
      const config: GeneratorConfig = {
        entityName: 'payment',
        options: { crud: false, cache: false, events: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/services/payment.ts');
      expect(output.files[0].content).toContain('PaymentService');
      expect(output.files[0].content).toContain('PaymentData');
      expect(output.files[0].content).toContain('process');
      expect(output.files[0].content).toContain('validate');
      expect(output.files[0].content).toContain('paymentService');
    });

    it('should generate CRUD service when crud option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'user',
        options: { crud: true, cache: false, events: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('findById');
      expect(content).toContain('findByIdOrThrow');
      expect(content).toContain('list');
      expect(content).toContain('create');
      expect(content).toContain('update');
      expect(content).toContain('delete');
      expect(content).toContain('exists');
      expect(content).toContain('PrismaClient');
    });

    it('should include caching when cache option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'product',
        options: { crud: true, cache: true, events: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('getFromCache');
      expect(content).toContain('setInCache');
      expect(content).toContain('invalidateCache');
      expect(content).toContain('CACHE_TTL');
    });

    it('should generate event service when events option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'order',
        options: { crud: false, cache: false, events: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('EventEmitter');
      expect(content).toContain('OrderEvents');
      expect(content).toContain('order:created');
      expect(content).toContain('order:updated');
      expect(content).toContain('order:deleted');
      expect(content).toContain('this.emit');
    });

    it('should include post-generation instructions', async () => {
      const config: GeneratorConfig = {
        entityName: 'custom',
        options: { crud: false, cache: false, events: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('service');
    });
  });
});
