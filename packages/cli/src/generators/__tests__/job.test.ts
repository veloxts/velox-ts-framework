/**
 * Job Generator - Unit Tests
 *
 * Tests for background job template generation.
 */

import { describe, expect, it } from 'vitest';

import { createJobGenerator } from '../generators/job.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('JobGenerator', () => {
  const generator = createJobGenerator();

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
      expect(generator.metadata.name).toBe('job');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('j');
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
      expect(generator.validateEntityName('send-email')).toBeUndefined();
      expect(generator.validateEntityName('process-payment')).toBeUndefined();
      expect(generator.validateEntityName('ImportData')).toBeUndefined();
    });

    it('should reject invalid names', () => {
      expect(generator.validateEntityName('')).toBeDefined();
      expect(generator.validateEntityName('123job')).toBeDefined();
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.queue).toBe(false);
      expect(options.retry).toBe(false);
      expect(options.progress).toBe(false);
    });

    it('should accept queue option', () => {
      const options = generator.validateOptions({ queue: true });
      expect(options.queue).toBe(true);
    });

    it('should accept retry option', () => {
      const options = generator.validateOptions({ retry: true });
      expect(options.retry).toBe(true);
    });

    it('should accept progress option', () => {
      const options = generator.validateOptions({ progress: true });
      expect(options.progress).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate simple job file', async () => {
      const config: GeneratorConfig = {
        entityName: 'send-email',
        options: { queue: false, retry: false, progress: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/jobs/send-email.ts');
      expect(output.files[0].content).toContain('SendEmailJob');
      expect(output.files[0].content).toContain('SendEmailJobSchema');
      expect(output.files[0].content).toContain('defineJob');
      expect(output.files[0].content).toContain('sendEmailJob');
      expect(output.files[0].content).toContain('handler');
    });

    it('should generate job with custom queue when queue option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'process-payment',
        options: { queue: true, retry: false, progress: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain("queue: 'processPayment'");
      expect(content).toContain('Custom queue for this job type');
    });

    it('should generate job with retry configuration when retry option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'import-data',
        options: { queue: false, retry: true, progress: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('attempts: 5');
      expect(content).toContain('backoff');
      expect(content).toContain('exponential');
      expect(content).toContain('attemptNumber');
      expect(content).toContain('timeout: 60000');
    });

    it('should generate job with progress tracking when progress option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'batch-export',
        options: { queue: false, retry: false, progress: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('progress');
      expect(content).toContain('await progress(0)');
      expect(content).toContain('percentComplete');
      expect(content).toContain('items: z.array');
    });

    it('should use kebab-case for job name', async () => {
      const config: GeneratorConfig = {
        entityName: 'ProcessPayment',
        options: { queue: false, retry: false, progress: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain("name: 'process-payment'");
    });

    it('should include Zod schema validation', async () => {
      const config: GeneratorConfig = {
        entityName: 'notify-user',
        options: { queue: false, retry: false, progress: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain("import { z } from 'zod'");
      expect(content).toContain('NotifyUserJobSchema');
      expect(content).toContain('z.object');
      expect(content).toContain('schema: NotifyUserJobSchema');
    });

    it('should include post-generation instructions', async () => {
      const config: GeneratorConfig = {
        entityName: 'custom',
        options: { queue: false, retry: false, progress: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('job');
      expect(output.postInstructions).toContain('queue.dispatch');
    });

    it('should include specific instructions for queue option', async () => {
      const config: GeneratorConfig = {
        entityName: 'custom',
        options: { queue: true, retry: false, progress: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toContain('queue is configured');
    });
  });
});
