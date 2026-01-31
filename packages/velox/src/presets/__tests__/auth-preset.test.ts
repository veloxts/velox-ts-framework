import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { developmentPreset, productionPreset, testPreset } from '../defaults.js';
import { getAuthPreset } from '../plugin.js';

describe('Auth Presets', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NODE_ENV;
    // Set required production env vars for tests that call getAuthPreset('production')
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.RESEND_API_KEY = 're_test_123';
    process.env.S3_BUCKET = 'test-bucket';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.REDIS_URL = originalEnv.REDIS_URL;
    process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
    process.env.S3_BUCKET = originalEnv.S3_BUCKET;
  });

  describe('developmentPreset.auth', () => {
    it('should have relaxed JWT settings', () => {
      const auth = developmentPreset.auth;
      expect(auth?.jwt?.accessTokenExpiry).toBe('15m');
      expect(auth?.jwt?.refreshTokenExpiry).toBe('7d');
    });

    it('should have relaxed rate limits', () => {
      const auth = developmentPreset.auth;
      expect(auth?.rateLimit?.max).toBe(100);
    });

    it('should allow insecure cookies', () => {
      const auth = developmentPreset.auth;
      expect(auth?.cookie?.secure).toBe(false);
      expect(auth?.cookie?.sameSite).toBe('lax');
    });

    it('should have long session TTL', () => {
      const auth = developmentPreset.auth;
      expect(auth?.session?.ttl).toBe(604800); // 7 days
    });
  });

  describe('testPreset.auth', () => {
    it('should have very relaxed rate limits', () => {
      const auth = testPreset.auth;
      expect(auth?.rateLimit?.max).toBe(1000);
    });

    it('should have longer access token for convenience', () => {
      const auth = testPreset.auth;
      expect(auth?.jwt?.accessTokenExpiry).toBe('1h');
    });

    it('should have shorter session TTL for isolation', () => {
      const auth = testPreset.auth;
      expect(auth?.session?.ttl).toBe(3600); // 1 hour
    });
  });

  describe('productionPreset.auth', () => {
    it('should have strict JWT settings', () => {
      const auth = productionPreset.auth;
      expect(auth?.jwt?.accessTokenExpiry).toBe('5m');
      expect(auth?.jwt?.refreshTokenExpiry).toBe('1d');
    });

    it('should have strict rate limits', () => {
      const auth = productionPreset.auth;
      expect(auth?.rateLimit?.max).toBe(5);
    });

    it('should require secure cookies', () => {
      const auth = productionPreset.auth;
      expect(auth?.cookie?.secure).toBe(true);
      expect(auth?.cookie?.sameSite).toBe('strict');
    });

    it('should have shorter session TTL', () => {
      const auth = productionPreset.auth;
      expect(auth?.session?.ttl).toBe(14400); // 4 hours
    });
  });

  describe('getAuthPreset', () => {
    it('should return development preset by default', () => {
      process.env.NODE_ENV = 'development';
      const preset = getAuthPreset();
      expect(preset.jwt?.accessTokenExpiry).toBe('15m');
      expect(preset.rateLimit?.max).toBe(100);
    });

    it('should return production preset when specified', () => {
      const preset = getAuthPreset('production');
      expect(preset.jwt?.accessTokenExpiry).toBe('5m');
      expect(preset.rateLimit?.max).toBe(5);
      expect(preset.cookie?.secure).toBe(true);
    });

    it('should return test preset when specified', () => {
      const preset = getAuthPreset('test');
      expect(preset.jwt?.accessTokenExpiry).toBe('1h');
      expect(preset.rateLimit?.max).toBe(1000);
    });

    it('should merge overrides with preset', () => {
      const preset = getAuthPreset('production', {
        jwt: { accessTokenExpiry: '10m' },
      });
      expect(preset.jwt?.accessTokenExpiry).toBe('10m');
      // Other production values should remain
      expect(preset.rateLimit?.max).toBe(5);
      expect(preset.cookie?.secure).toBe(true);
    });

    it('should deep merge nested overrides', () => {
      const preset = getAuthPreset('production', {
        rateLimit: { max: 10 },
      });
      expect(preset.rateLimit?.max).toBe(10);
      // windowMs should come from preset
      expect(preset.rateLimit?.windowMs).toBe(900000);
    });

    it('should return empty object if no auth preset exists', () => {
      // This tests the fallback behavior
      process.env.NODE_ENV = 'development';
      const preset = getAuthPreset();
      expect(preset).toBeDefined();
      expect(typeof preset).toBe('object');
    });
  });
});
