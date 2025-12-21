/**
 * Middleware Generator - Unit Tests
 *
 * Tests for middleware template generation.
 */

import { describe, expect, it } from 'vitest';

import { createMiddlewareGenerator } from '../generators/middleware.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('MiddlewareGenerator', () => {
  const generator = createMiddlewareGenerator();

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
      expect(generator.metadata.name).toBe('middleware');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('mw');
      expect(generator.metadata.aliases).toContain('mid');
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
      expect(generator.validateEntityName('request-logger')).toBeUndefined();
      expect(generator.validateEntityName('RateLimiter')).toBeUndefined();
      expect(generator.validateEntityName('cors_handler')).toBeUndefined();
    });

    it('should reject invalid names', () => {
      expect(generator.validateEntityName('')).toBeDefined();
      expect(generator.validateEntityName('123invalid')).toBeDefined();
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.timing).toBe(false);
      expect(options.logging).toBe(false);
      expect(options.rateLimit).toBe(false);
      expect(options.cors).toBe(false);
    });

    it('should accept timing option', () => {
      const options = generator.validateOptions({ timing: true });
      expect(options.timing).toBe(true);
    });

    it('should accept logging option', () => {
      const options = generator.validateOptions({ logging: true });
      expect(options.logging).toBe(true);
    });

    it('should accept rate option (maps to rateLimit)', () => {
      const options = generator.validateOptions({ rate: true });
      expect(options.rateLimit).toBe(true);
    });

    it('should accept cors option', () => {
      const options = generator.validateOptions({ cors: true });
      expect(options.cors).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate simple middleware file', async () => {
      const config: GeneratorConfig = {
        entityName: 'request-handler',
        options: { timing: false, logging: false, rateLimit: false, cors: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/middleware/request-handler.ts');
      expect(output.files[0].content).toContain('fastify-plugin');
      expect(output.files[0].content).toContain('RequestHandlerMiddlewareOptions');
      expect(output.files[0].content).toContain('addHook');
    });

    it('should generate timing middleware when timing option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'timing',
        options: { timing: true, logging: false, rateLimit: false, cors: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('startTime');
      expect(content).toContain('X-Response-Time');
      expect(content).toContain('performance.now');
    });

    it('should generate logging middleware when logging option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'logger',
        options: { timing: false, logging: true, rateLimit: false, cors: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('LogContext');
      expect(content).toContain('request.log.info');
      expect(content).toContain('onResponse');
      expect(content).toContain('onError');
    });

    it('should generate rate limit middleware when rate option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'limiter',
        options: { timing: false, logging: false, rateLimit: true, cors: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('RateLimitOptions');
      expect(content).toContain('X-RateLimit-Limit');
      expect(content).toContain('X-RateLimit-Remaining');
      expect(content).toContain('429');
      expect(content).toContain('Too Many Requests');
    });

    it('should generate CORS middleware when cors option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'cors',
        options: { timing: false, logging: false, rateLimit: false, cors: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('CorsOptions');
      expect(content).toContain('Access-Control-Allow-Origin');
      expect(content).toContain('Access-Control-Allow-Methods');
      expect(content).toContain('preflight');
    });

    it('should include post-generation instructions', async () => {
      const config: GeneratorConfig = {
        entityName: 'custom',
        options: { timing: false, logging: false, rateLimit: false, cors: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('Register');
      expect(output.postInstructions).toContain('middleware');
    });
  });
});
