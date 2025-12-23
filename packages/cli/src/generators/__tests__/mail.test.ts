/**
 * Mail Generator - Unit Tests
 *
 * Tests for email template generation.
 */

import { describe, expect, it } from 'vitest';

import { createMailGenerator } from '../generators/mail.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('MailGenerator', () => {
  const generator = createMailGenerator();

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
      expect(generator.metadata.name).toBe('mail');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('email');
      expect(generator.metadata.aliases).toContain('m');
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
      expect(generator.validateEntityName('welcome')).toBeUndefined();
      expect(generator.validateEntityName('password-reset')).toBeUndefined();
      expect(generator.validateEntityName('OrderConfirmation')).toBeUndefined();
    });

    it('should reject invalid names', () => {
      expect(generator.validateEntityName('')).toBeDefined();
      expect(generator.validateEntityName('123email')).toBeDefined();
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.text).toBe(false);
      expect(options.attachment).toBe(false);
    });

    it('should accept text option', () => {
      const options = generator.validateOptions({ text: true });
      expect(options.text).toBe(true);
    });

    it('should accept attachment option', () => {
      const options = generator.validateOptions({ attachment: true });
      expect(options.attachment).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate React Email template by default', async () => {
      const config: GeneratorConfig = {
        entityName: 'welcome',
        options: { text: false, attachment: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/mail/welcome.tsx');
      expect(output.files[0].content).toContain('WelcomeEmail');
      expect(output.files[0].content).toContain('WelcomeEmailSchema');
      expect(output.files[0].content).toContain('defineMail');
      expect(output.files[0].content).toContain('welcomeEmail');
      expect(output.files[0].content).toContain('@react-email/components');
    });

    it('should generate plain text email when text option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'notification',
        options: { text: true, attachment: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(output.files[0].path).toBe('src/mail/notification.ts');
      expect(content).toContain('text: ({');
      expect(content).toContain('Plain text email');
      expect(content).not.toContain('@react-email/components');
      expect(content).toContain('template should not be called');
    });

    it('should generate email with attachment support when attachment option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'invoice',
        options: { text: false, attachment: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(output.files[0].path).toBe('src/mail/invoice.tsx');
      expect(content).toContain('downloadUrl');
      expect(content).toContain('attachments');
      expect(content).toContain('Download Now');
      expect(content).toContain('attachment support');
    });

    it('should include React Email components', async () => {
      const config: GeneratorConfig = {
        entityName: 'password-reset',
        options: { text: false, attachment: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('Html');
      expect(content).toContain('Head');
      expect(content).toContain('Body');
      expect(content).toContain('Container');
      expect(content).toContain('Heading');
      expect(content).toContain('Text');
      expect(content).toContain('Button');
      expect(content).toContain('Preview');
    });

    it('should include Zod schema validation', async () => {
      const config: GeneratorConfig = {
        entityName: 'order-confirmation',
        options: { text: false, attachment: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain("import { z } from 'zod'");
      expect(content).toContain('OrderConfirmationEmailSchema');
      expect(content).toContain('z.object');
      expect(content).toContain('schema: OrderConfirmationEmailSchema');
    });

    it('should include inline styles', async () => {
      const config: GeneratorConfig = {
        entityName: 'welcome',
        options: { text: false, attachment: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('const main =');
      expect(content).toContain('const container =');
      expect(content).toContain('const h1 =');
      expect(content).toContain('const text =');
      expect(content).toContain('const button =');
      expect(content).toContain('const footer =');
    });

    it('should use kebab-case for mail name', async () => {
      const config: GeneratorConfig = {
        entityName: 'OrderConfirmation',
        options: { text: false, attachment: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain("name: 'order-confirmation'");
    });

    it('should include subject function', async () => {
      const config: GeneratorConfig = {
        entityName: 'welcome',
        options: { text: false, attachment: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('subject: ({');
      expect(content).toContain('name }) =>');
    });

    it('should include both HTML and text versions by default', async () => {
      const config: GeneratorConfig = {
        entityName: 'welcome',
        options: { text: false, attachment: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('template: ({');
      expect(content).toContain('text: ({');
    });

    it('should include post-generation instructions', async () => {
      const config: GeneratorConfig = {
        entityName: 'custom',
        options: { text: false, attachment: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('email');
      expect(output.postInstructions).toContain('mail.send');
    });

    it('should include specific instructions for text option', async () => {
      const config: GeneratorConfig = {
        entityName: 'custom',
        options: { text: true, attachment: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toContain('plain text');
    });

    it('should include specific instructions for attachment option', async () => {
      const config: GeneratorConfig = {
        entityName: 'custom',
        options: { text: false, attachment: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toContain('attachments');
    });
  });
});
