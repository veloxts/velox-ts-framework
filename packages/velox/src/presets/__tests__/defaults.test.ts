import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  developmentPreset,
  getPreset,
  PRODUCTION_ENV_VARS,
  presets,
  productionPreset,
  testPreset,
  validateProductionEnv,
} from '../defaults.js';

describe('Preset Defaults', () => {
  describe('developmentPreset', () => {
    it('should use memory driver for cache', () => {
      expect(developmentPreset.cache?.driver).toBe('memory');
    });

    it('should use sync driver for queue', () => {
      expect(developmentPreset.queue?.driver).toBe('sync');
    });

    it('should use log driver for mail', () => {
      expect(developmentPreset.mail?.driver).toBe('log');
    });

    it('should use local driver for storage', () => {
      expect(developmentPreset.storage?.driver).toBe('local');
    });

    it('should use ws driver for events', () => {
      expect(developmentPreset.events?.driver).toBe('ws');
    });
  });

  describe('testPreset', () => {
    it('should use memory driver for cache', () => {
      expect(testPreset.cache?.driver).toBe('memory');
    });

    it('should use sync driver for queue', () => {
      expect(testPreset.queue?.driver).toBe('sync');
    });

    it('should use temp directory for storage', () => {
      expect(testPreset.storage?.driver).toBe('local');
      expect((testPreset.storage as { root?: string })?.root).toContain('test');
    });
  });

  describe('productionPreset', () => {
    it('should use redis driver for cache', () => {
      expect(productionPreset.cache?.driver).toBe('redis');
    });

    it('should use bullmq driver for queue', () => {
      expect(productionPreset.queue?.driver).toBe('bullmq');
    });

    it('should use resend driver for mail', () => {
      expect(productionPreset.mail?.driver).toBe('resend');
    });

    it('should use s3 driver for storage', () => {
      expect(productionPreset.storage?.driver).toBe('s3');
    });

    it('should configure events with redis option', () => {
      expect(productionPreset.events?.driver).toBe('ws');
      // Redis config reads from env var, may be undefined in tests
      expect('redis' in (productionPreset.events ?? {})).toBe(true);
    });
  });

  describe('validateProductionEnv', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      // Clear relevant env vars
      delete process.env.REDIS_URL;
      delete process.env.RESEND_API_KEY;
      delete process.env.S3_BUCKET;
    });

    afterEach(() => {
      // Restore original env
      process.env.REDIS_URL = originalEnv.REDIS_URL;
      process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
      process.env.S3_BUCKET = originalEnv.S3_BUCKET;
    });

    it('should throw when all required env vars are missing', () => {
      expect(() => validateProductionEnv()).toThrow(
        'Missing required environment variables for production preset'
      );
    });

    it('should throw with descriptive error listing missing vars', () => {
      try {
        validateProductionEnv();
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('REDIS_URL');
        expect(message).toContain('RESEND_API_KEY');
        expect(message).toContain('S3_BUCKET');
      }
    });

    it('should not throw when all required env vars are set', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.RESEND_API_KEY = 're_test_123';
      process.env.S3_BUCKET = 'my-bucket';

      expect(() => validateProductionEnv()).not.toThrow();
    });

    it('should throw listing only missing vars', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      // RESEND_API_KEY and S3_BUCKET still missing

      try {
        validateProductionEnv();
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain('REDIS_URL:');
        expect(message).toContain('RESEND_API_KEY');
        expect(message).toContain('S3_BUCKET');
      }
    });
  });

  describe('PRODUCTION_ENV_VARS', () => {
    it('should document all required env vars', () => {
      expect(PRODUCTION_ENV_VARS.REDIS_URL).toBeDefined();
      expect(PRODUCTION_ENV_VARS.RESEND_API_KEY).toBeDefined();
      expect(PRODUCTION_ENV_VARS.S3_BUCKET).toBeDefined();
      expect(PRODUCTION_ENV_VARS.AWS_REGION).toBeDefined();
    });
  });

  describe('getPreset', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env.REDIS_URL = originalEnv.REDIS_URL;
      process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
      process.env.S3_BUCKET = originalEnv.S3_BUCKET;
    });

    it('should return development preset', () => {
      expect(getPreset('development')).toBe(developmentPreset);
    });

    it('should return test preset', () => {
      expect(getPreset('test')).toBe(testPreset);
    });

    it('should throw for production when env vars are missing', () => {
      delete process.env.REDIS_URL;
      delete process.env.RESEND_API_KEY;
      delete process.env.S3_BUCKET;

      expect(() => getPreset('production')).toThrow('Missing required environment variables');
    });

    it('should return fresh production preset when env vars are set', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.RESEND_API_KEY = 're_test_123';
      process.env.S3_BUCKET = 'my-bucket';

      const preset = getPreset('production');
      expect(preset.cache?.driver).toBe('redis');
      expect(preset.queue?.driver).toBe('bullmq');
      expect(preset.mail?.driver).toBe('resend');
      expect(preset.storage?.driver).toBe('s3');
    });
  });

  describe('presets object', () => {
    it('should contain all environments', () => {
      expect(presets.development).toBe(developmentPreset);
      expect(presets.test).toBe(testPreset);
      expect(presets.production).toBe(productionPreset);
    });
  });
});
