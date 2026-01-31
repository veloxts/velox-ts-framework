import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  detectEnvironment,
  isDevelopment,
  isProduction,
  isTest,
  validateEnvironment,
} from '../env.js';

describe('Environment Detection', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('detectEnvironment', () => {
    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(detectEnvironment()).toBe('development');

      process.env.NODE_ENV = 'dev';
      expect(detectEnvironment()).toBe('development');
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(detectEnvironment()).toBe('production');

      process.env.NODE_ENV = 'prod';
      expect(detectEnvironment()).toBe('production');
    });

    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(detectEnvironment()).toBe('test');

      process.env.NODE_ENV = 'testing';
      expect(detectEnvironment()).toBe('test');
    });

    it('should default to development when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      expect(detectEnvironment()).toBe('development');
    });

    it('should handle case-insensitive values', () => {
      process.env.NODE_ENV = 'PRODUCTION';
      expect(detectEnvironment()).toBe('production');

      process.env.NODE_ENV = 'Development';
      expect(detectEnvironment()).toBe('development');
    });

    it('should handle whitespace', () => {
      process.env.NODE_ENV = '  production  ';
      expect(detectEnvironment()).toBe('production');
    });
  });

  describe('isDevelopment', () => {
    it('should return true in development', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevelopment()).toBe(true);
    });

    it('should return false in production', () => {
      process.env.NODE_ENV = 'production';
      expect(isDevelopment()).toBe(false);
    });
  });

  describe('isProduction', () => {
    it('should return true in production', () => {
      process.env.NODE_ENV = 'production';
      expect(isProduction()).toBe(true);
    });

    it('should return false in development', () => {
      process.env.NODE_ENV = 'development';
      expect(isProduction()).toBe(false);
    });
  });

  describe('isTest', () => {
    it('should return true in test', () => {
      process.env.NODE_ENV = 'test';
      expect(isTest()).toBe(true);
    });

    it('should return false in development', () => {
      process.env.NODE_ENV = 'development';
      expect(isTest()).toBe(false);
    });
  });

  describe('validateEnvironment', () => {
    it('should validate development', () => {
      expect(validateEnvironment('development')).toBe('development');
      expect(validateEnvironment('dev')).toBe('development');
    });

    it('should validate production', () => {
      expect(validateEnvironment('production')).toBe('production');
      expect(validateEnvironment('prod')).toBe('production');
    });

    it('should validate test', () => {
      expect(validateEnvironment('test')).toBe('test');
      expect(validateEnvironment('testing')).toBe('test');
    });

    it('should throw for invalid environment', () => {
      expect(() => validateEnvironment('staging')).toThrow('Invalid environment');
      expect(() => validateEnvironment('local')).toThrow('Invalid environment');
    });
  });
});
