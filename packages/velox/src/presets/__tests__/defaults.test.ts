import { describe, expect, it } from 'vitest';

import {
  developmentPreset,
  getPreset,
  presets,
  productionPreset,
  testPreset,
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

  describe('getPreset', () => {
    it('should return development preset', () => {
      expect(getPreset('development')).toBe(developmentPreset);
    });

    it('should return test preset', () => {
      expect(getPreset('test')).toBe(testPreset);
    });

    it('should return production preset', () => {
      expect(getPreset('production')).toBe(productionPreset);
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
