/**
 * Exception Generator - Unit Tests
 *
 * Tests for exception class template generation.
 */

import { describe, expect, it } from 'vitest';

import { createExceptionGenerator } from '../generators/exception.js';
import type { GeneratorConfig, ProjectContext } from '../types.js';

describe('ExceptionGenerator', () => {
  const generator = createExceptionGenerator();

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
      expect(generator.metadata.name).toBe('exception');
    });

    it('should have aliases', () => {
      expect(generator.metadata.aliases).toContain('ex');
      expect(generator.metadata.aliases).toContain('err');
      expect(generator.metadata.aliases).toContain('error');
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
      expect(generator.validateEntityName('user-auth')).toBeUndefined();
      expect(generator.validateEntityName('ValidationError')).toBeUndefined();
    });

    it('should reject invalid names', () => {
      expect(generator.validateEntityName('')).toBeDefined();
      expect(generator.validateEntityName('123error')).toBeDefined();
    });
  });

  describe('validateOptions', () => {
    it('should return defaults for empty options', () => {
      const options = generator.validateOptions({});

      expect(options.http).toBe(false);
      expect(options.validation).toBe(false);
      expect(options.domain).toBe(false);
      expect(options.codes).toBe(false);
    });

    it('should accept http option', () => {
      const options = generator.validateOptions({ http: true });
      expect(options.http).toBe(true);
    });

    it('should accept validation option', () => {
      const options = generator.validateOptions({ validation: true });
      expect(options.validation).toBe(true);
    });

    it('should accept domain option', () => {
      const options = generator.validateOptions({ domain: true });
      expect(options.domain).toBe(true);
    });

    it('should accept codes option', () => {
      const options = generator.validateOptions({ codes: true });
      expect(options.codes).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate simple exception file', async () => {
      const config: GeneratorConfig = {
        entityName: 'payment',
        options: { http: false, validation: false, domain: false, codes: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.files).toHaveLength(1);
      expect(output.files[0].path).toBe('src/exceptions/payment.ts');
      expect(output.files[0].content).toContain('PaymentException');
      expect(output.files[0].content).toContain('paymentNotFound');
      expect(output.files[0].content).toContain('paymentInvalid');
      expect(output.files[0].content).toContain('paymentUnauthorized');
      expect(output.files[0].content).toContain('isPaymentException');
      expect(output.files[0].content).toContain('wrapPaymentException');
    });

    it('should generate HTTP exception when http option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'api',
        options: { http: true, validation: false, domain: false, codes: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('HttpException');
      expect(content).toContain('statusCode');
      expect(content).toContain('ApiNotFoundException');
      expect(content).toContain('ApiConflictException');
      expect(content).toContain('ApiForbiddenException');
      expect(content).toContain('ApiBadRequestException');
      expect(content).toContain('ApiUnprocessableException');
      expect(content).toContain('404');
      expect(content).toContain('409');
      expect(content).toContain('403');
      expect(content).toContain('400');
      expect(content).toContain('422');
    });

    it('should generate validation exception when validation option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'form',
        options: { http: false, validation: true, domain: false, codes: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('FormValidationException');
      expect(content).toContain('FieldError');
      expect(content).toContain('fromZodError');
      expect(content).toContain('getFieldErrors');
      expect(content).toContain('hasFieldError');
      expect(content).toContain('toFieldErrors');
      expect(content).toContain('formRequired');
      expect(content).toContain('formInvalidFormat');
      expect(content).toContain('formOutOfRange');
    });

    it('should generate domain exception when domain option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'order',
        options: { http: false, validation: false, domain: true, codes: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('OrderException');
      expect(content).toContain('OrderNotFoundException');
      expect(content).toContain('OrderAlreadyExistsException');
      expect(content).toContain('OrderInvalidStateException');
      expect(content).toContain('OrderLimitExceededException');
      expect(content).toContain('OrderExpiredException');
      expect(content).toContain('isOrderException');
      expect(content).toContain('assertOrder');
    });

    it('should include error codes when codes option is true', async () => {
      const config: GeneratorConfig = {
        entityName: 'auth',
        options: { http: false, validation: false, domain: true, codes: true },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);
      const content = output.files[0].content;

      expect(content).toContain('AuthErrorCode');
      expect(content).toContain('AUTH_NOT_FOUND');
      expect(content).toContain('AUTH_ALREADY_EXISTS');
      expect(content).toContain('AUTH_INVALID_STATE');
      expect(content).toContain('AUTH_LIMIT_EXCEEDED');
      expect(content).toContain('AUTH_EXPIRED');
      expect(content).toContain('AuthErrorCodeType');
    });

    it('should include post-generation instructions', async () => {
      const config: GeneratorConfig = {
        entityName: 'custom',
        options: { http: false, validation: false, domain: false, codes: false },
        cwd: '/test',
        project: mockProject,
        dryRun: false,
        force: false,
        conflictStrategy: 'prompt',
      };

      const output = await generator.generate(config);

      expect(output.postInstructions).toBeDefined();
      expect(output.postInstructions).toContain('exception');
    });
  });
});
