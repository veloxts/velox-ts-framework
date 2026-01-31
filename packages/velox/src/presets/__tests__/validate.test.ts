import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validateAuthSecrets, validateSecurity, validateSecurityOrThrow } from '../validate.js';

describe('Security Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.SESSION_SECRET;
  });

  afterEach(() => {
    // Restore original env
    Object.assign(process.env, originalEnv);
  });

  describe('validateSecurity', () => {
    it('should return valid when all requirements are met', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

      const result = validateSecurity();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report missing required env vars', () => {
      const result = validateSecurity();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.key === 'DATABASE_URL')).toBe(true);
    });

    it('should report short secrets', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'short';

      const result = validateSecurity();

      expect(result.valid).toBe(false);
      const jwtError = result.errors.find((e) => e.key === 'JWT_SECRET');
      expect(jwtError).toBeDefined();
      expect(jwtError?.message).toContain('too short');
    });

    it('should warn about weak secrets', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'a'.repeat(32); // All same character

      const result = validateSecurity();

      // Should pass validation (length is ok)
      expect(result.valid).toBe(true);
      // But should have warning about low entropy
      const warning = result.warnings.find((w) => w.key === 'JWT_SECRET');
      expect(warning).toBeDefined();
      expect(warning?.message).toContain('entropy');
    });

    it('should detect common weak passwords', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'my_secret_password_for_testing_12345';

      const result = validateSecurity();

      expect(result.valid).toBe(true);
      const warning = result.warnings.find((w) => w.key === 'JWT_SECRET');
      expect(warning).toBeDefined();
    });

    it('should accept custom requirements', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.CUSTOM_VAR = 'value';

      const result = validateSecurity({
        requiredEnvVars: {
          CUSTOM_VAR: 'Custom variable description',
        },
        secretEnvVars: [], // No secrets to check
      });

      expect(result.valid).toBe(true);
    });

    it('should include suggestions in errors', () => {
      const result = validateSecurity();

      const dbError = result.errors.find((e) => e.key === 'DATABASE_URL');
      expect(dbError?.suggestion).toBeDefined();
    });
  });

  describe('validateSecurityOrThrow', () => {
    it('should not throw in development environment', () => {
      process.env.NODE_ENV = 'development';

      expect(() => validateSecurityOrThrow()).not.toThrow();
    });

    it('should not throw in test environment', () => {
      process.env.NODE_ENV = 'test';

      expect(() => validateSecurityOrThrow()).not.toThrow();
    });

    it('should throw in production when validation fails', () => {
      process.env.NODE_ENV = 'production';

      expect(() => validateSecurityOrThrow()).toThrow('Production security validation failed');
    });

    it('should not throw in production when validation passes', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'secure_random_secret_that_is_long_enough_123456';
      process.env.JWT_REFRESH_SECRET = 'another_secure_random_secret_long_enough_789';

      expect(() => validateSecurityOrThrow()).not.toThrow();
    });

    it('should log warnings when validation passes with warnings', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.JWT_SECRET = 'secure_random_secret_that_is_long_enough_123456';
      // JWT_REFRESH_SECRET not set - should warn

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => validateSecurityOrThrow()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should include all errors in thrown message', () => {
      process.env.NODE_ENV = 'production';

      try {
        validateSecurityOrThrow();
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('DATABASE_URL');
      }
    });
  });

  describe('validateAuthSecrets', () => {
    it('should not throw in development', () => {
      process.env.NODE_ENV = 'development';

      expect(() => validateAuthSecrets()).not.toThrow();
    });

    it('should throw in production when auth secrets are missing', () => {
      process.env.NODE_ENV = 'production';

      expect(() => validateAuthSecrets()).toThrow('Missing required auth secrets');
    });

    it('should throw when JWT_SECRET is too short', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short';
      process.env.JWT_REFRESH_SECRET = 'also_short';
      process.env.SESSION_SECRET = 'session_secret_that_is_long_enough_1234567890';

      expect(() => validateAuthSecrets()).toThrow('too short');
    });

    it('should not throw when secrets are valid', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'secure_random_secret_that_is_long_enough_123456';
      process.env.JWT_REFRESH_SECRET = 'another_secure_random_secret_long_enough_789';
      process.env.SESSION_SECRET = 'session_secret_that_is_long_enough_1234567890';

      expect(() => validateAuthSecrets()).not.toThrow();
    });

    it('should accept explicit environment parameter', () => {
      // NODE_ENV is not set, but we pass 'development' explicitly
      expect(() => validateAuthSecrets('development')).not.toThrow();

      // Production should fail without secrets
      expect(() => validateAuthSecrets('production')).toThrow();
    });
  });
});
