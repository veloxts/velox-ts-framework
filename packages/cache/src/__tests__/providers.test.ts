/**
 * Tests for Cache DI Providers
 *
 * Validates:
 * - registerCacheProviders bulk registration works correctly
 * - Services can be mocked/overridden in tests
 * - Cache manager is properly initialized
 */

import { Container } from '@veloxts/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CacheManager } from '../manager.js';
import { registerCacheProviders } from '../providers.js';
import { CACHE_CONFIG, CACHE_MANAGER } from '../tokens.js';

describe('Cache DI Providers', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('registerCacheProviders', () => {
    it('registers all cache providers at once', async () => {
      await registerCacheProviders(container, { driver: 'memory' });

      expect(container.isRegistered(CACHE_CONFIG)).toBe(true);
      expect(container.isRegistered(CACHE_MANAGER)).toBe(true);
    });

    it('config values are accessible from container', async () => {
      await registerCacheProviders(container, {
        driver: 'memory',
        prefix: 'test:',
      });

      const config = container.resolve(CACHE_CONFIG);

      expect(config.driver).toBe('memory');
      expect(config.prefix).toBe('test:');
    });

    it('uses memory driver by default', async () => {
      await registerCacheProviders(container);

      const config = container.resolve(CACHE_CONFIG);

      expect(config.driver).toBeUndefined(); // defaults to memory internally
    });

    it('cache manager is fully functional after registration', async () => {
      await registerCacheProviders(container, { driver: 'memory' });

      const cache = container.resolve(CACHE_MANAGER);

      // Basic operations should work
      await cache.put('test-key', 'test-value', '1h');
      const value = await cache.get<string>('test-key');

      expect(value).toBe('test-value');
    });

    it('cache manager supports remember pattern', async () => {
      await registerCacheProviders(container, { driver: 'memory' });

      const cache = container.resolve(CACHE_MANAGER);

      const factory = vi.fn().mockResolvedValue('computed-value');

      // First call - should invoke factory
      const value1 = await cache.remember('remember-key', '1h', factory);
      expect(value1).toBe('computed-value');
      expect(factory).toHaveBeenCalledTimes(1);

      // Second call - should return cached value
      const value2 = await cache.remember('remember-key', '1h', factory);
      expect(value2).toBe('computed-value');
      expect(factory).toHaveBeenCalledTimes(1); // Not called again
    });

    it('cache manager supports tags', async () => {
      await registerCacheProviders(container, { driver: 'memory' });

      const cache = container.resolve(CACHE_MANAGER);

      // Put value with tags
      await cache.tags(['users']).put('user:1', { id: '1', name: 'Test' });
      await cache.tags(['users']).put('user:2', { id: '2', name: 'Test2' });

      // Values should be retrievable
      const user1 = await cache.tags(['users']).get('user:1');
      expect(user1).toEqual({ id: '1', name: 'Test' });

      // Flush by tag
      await cache.tags(['users']).flush();

      // Values should be gone
      const afterFlush = await cache.tags(['users']).get('user:1');
      expect(afterFlush).toBeNull();
    });

    it('cache manager supports forget', async () => {
      await registerCacheProviders(container, { driver: 'memory' });

      const cache = container.resolve(CACHE_MANAGER);

      await cache.put('to-forget', 'value');
      expect(await cache.get('to-forget')).toBe('value');

      await cache.forget('to-forget');
      expect(await cache.get('to-forget')).toBeNull();
    });

    it('cache manager supports flush', async () => {
      await registerCacheProviders(container, { driver: 'memory' });

      const cache = container.resolve(CACHE_MANAGER);

      await cache.put('key1', 'value1');
      await cache.put('key2', 'value2');

      await cache.flush();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });
  });

  describe('Service Mocking', () => {
    it('allows mocking CACHE_MANAGER after registration', async () => {
      await registerCacheProviders(container, { driver: 'memory' });

      // Create a mock cache manager
      const mockCacheManager: Partial<CacheManager> = {
        get: vi.fn().mockResolvedValue('mocked-value'),
        put: vi.fn().mockResolvedValue(undefined),
      };

      container.register({ provide: CACHE_MANAGER, useValue: mockCacheManager });

      const cache = container.resolve(CACHE_MANAGER);

      expect(cache).toBe(mockCacheManager);
      expect(await cache.get('any-key')).toBe('mocked-value');
    });

    it('allows mocking CACHE_CONFIG after registration', async () => {
      await registerCacheProviders(container, { driver: 'memory' });

      const mockConfig = { driver: 'redis' as const, prefix: 'mocked:' };
      container.register({ provide: CACHE_CONFIG, useValue: mockConfig });

      const config = container.resolve(CACHE_CONFIG);

      expect(config).toBe(mockConfig);
      expect(config.driver).toBe('redis');
    });

    it('child container can override parent registrations', async () => {
      await registerCacheProviders(container, { driver: 'memory' });

      const childContainer = container.createChild();

      const mockCacheManager: Partial<CacheManager> = {
        get: vi.fn().mockResolvedValue('child-value'),
      };

      childContainer.register({ provide: CACHE_MANAGER, useValue: mockCacheManager });

      const parentCache = container.resolve(CACHE_MANAGER);
      const childCache = childContainer.resolve(CACHE_MANAGER);

      expect(childCache).toBe(mockCacheManager);
      expect(parentCache).not.toBe(mockCacheManager);
    });

    it('child container inherits parent registrations', async () => {
      await registerCacheProviders(container, { driver: 'memory' });

      const childContainer = container.createChild();

      // Should resolve from parent
      const cache = childContainer.resolve(CACHE_MANAGER);
      const config = childContainer.resolve(CACHE_CONFIG);

      expect(cache).toBeDefined();
      expect(config).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('throws when resolving unregistered token', () => {
      expect(() => container.resolve(CACHE_MANAGER)).toThrow(
        'No provider found for: CACHE_MANAGER'
      );
    });

    it('throws when resolving CACHE_CONFIG without registration', () => {
      expect(() => container.resolve(CACHE_CONFIG)).toThrow('No provider found for: CACHE_CONFIG');
    });
  });

  describe('Integration with Real Services', () => {
    it('complete cache flow works with DI-provided services', async () => {
      await registerCacheProviders(container, {
        driver: 'memory',
        prefix: 'integration:',
      });

      const cache = container.resolve(CACHE_MANAGER);
      const config = container.resolve(CACHE_CONFIG);

      // Config should be accessible
      expect(config.driver).toBe('memory');
      expect(config.prefix).toBe('integration:');

      // Cache should be functional
      await cache.put('test', { data: 'value' }, '30m');
      const result = await cache.get<{ data: string }>('test');
      expect(result?.data).toBe('value');
    });

    it('multiple containers can have independent cache instances', async () => {
      const container1 = new Container();
      const container2 = new Container();

      await registerCacheProviders(container1, { driver: 'memory', prefix: 'c1:' });
      await registerCacheProviders(container2, { driver: 'memory', prefix: 'c2:' });

      const cache1 = container1.resolve(CACHE_MANAGER);
      const cache2 = container2.resolve(CACHE_MANAGER);

      // Different instances
      expect(cache1).not.toBe(cache2);

      // Independent state
      await cache1.put('shared-key', 'value1');
      await cache2.put('shared-key', 'value2');

      expect(await cache1.get('shared-key')).toBe('value1');
      expect(await cache2.get('shared-key')).toBe('value2');
    });

    it('cache supports TTL in various formats', async () => {
      await registerCacheProviders(container, { driver: 'memory' });

      const cache = container.resolve(CACHE_MANAGER);

      // String TTL formats
      await cache.put('key1', 'v1', '1h');
      await cache.put('key2', 'v2', '30m');
      await cache.put('key3', 'v3', '1d');

      // Numeric TTL (seconds)
      await cache.put('key4', 'v4', 3600);

      expect(await cache.get('key1')).toBe('v1');
      expect(await cache.get('key2')).toBe('v2');
      expect(await cache.get('key3')).toBe('v3');
      expect(await cache.get('key4')).toBe('v4');
    });
  });
});
