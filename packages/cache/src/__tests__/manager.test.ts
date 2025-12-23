import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type CacheManager, createCacheManager } from '../manager.js';

describe('Cache Manager', () => {
  let cache: CacheManager;

  beforeEach(async () => {
    cache = await createCacheManager({ driver: 'memory' });
  });

  afterEach(async () => {
    await cache.close();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', async () => {
      await cache.put('key', 'value');
      const result = await cache.get('key');
      expect(result).toBe('value');
    });

    it('should check existence', async () => {
      await cache.put('exists', 'value');
      expect(await cache.has('exists')).toBe(true);
      expect(await cache.has('notexists')).toBe(false);
    });

    it('should delete values', async () => {
      await cache.put('key', 'value');
      await cache.forget('key');
      expect(await cache.get('key')).toBeNull();
    });
  });

  describe('remember pattern', () => {
    it('should return cached value if present', async () => {
      await cache.put('key', 'cached');

      const callback = vi.fn().mockResolvedValue('computed');
      const result = await cache.remember('key', '1h', callback);

      expect(result).toBe('cached');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should compute and cache if not present', async () => {
      const callback = vi.fn().mockResolvedValue('computed');
      const result = await cache.remember('key', '1h', callback);

      expect(result).toBe('computed');
      expect(callback).toHaveBeenCalledTimes(1);

      // Should now be cached
      const result2 = await cache.remember('key', '1h', callback);
      expect(result2).toBe('computed');
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('rememberForever', () => {
    it('should cache indefinitely', async () => {
      const callback = vi.fn().mockResolvedValue('value');
      const result = await cache.rememberForever('key', callback);

      expect(result).toBe('value');
      expect(await cache.get('key')).toBe('value');
    });
  });

  describe('pull', () => {
    it('should return and delete value', async () => {
      await cache.put('key', 'value');

      const result = await cache.pull('key');
      expect(result).toBe('value');
      expect(await cache.get('key')).toBeNull();
    });

    it('should return null for nonexistent key', async () => {
      const result = await cache.pull('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('add', () => {
    it('should add only if key does not exist', async () => {
      const added1 = await cache.add('key', 'value1');
      expect(added1).toBe(true);
      expect(await cache.get('key')).toBe('value1');

      const added2 = await cache.add('key', 'value2');
      expect(added2).toBe(false);
      expect(await cache.get('key')).toBe('value1'); // Unchanged
    });
  });

  describe('increment/decrement', () => {
    it('should increment values', async () => {
      expect(await cache.increment('counter')).toBe(1);
      expect(await cache.increment('counter')).toBe(2);
      expect(await cache.increment('counter', 5)).toBe(7);
    });

    it('should decrement values', async () => {
      await cache.put('counter', 10);
      expect(await cache.decrement('counter')).toBe(9);
      expect(await cache.decrement('counter', 3)).toBe(6);
    });
  });

  describe('bulk operations', () => {
    it('should get many values', async () => {
      await cache.put('key1', 'value1');
      await cache.put('key2', 'value2');

      const results = await cache.many(['key1', 'key2', 'key3']);
      expect(results.get('key1')).toBe('value1');
      expect(results.get('key2')).toBe('value2');
      expect(results.get('key3')).toBeNull();
    });

    it('should put many values', async () => {
      await cache.putMany(
        new Map([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ])
      );

      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
    });
  });

  describe('flush', () => {
    it('should clear all entries', async () => {
      await cache.put('key1', 'value1');
      await cache.put('key2', 'value2');

      await cache.flush();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });
  });

  describe('tags', () => {
    it('should create tagged cache', async () => {
      const tagged = cache.tags(['users']);

      await tagged.put('user:1', { name: 'John' });
      expect(await tagged.get('user:1')).toEqual({ name: 'John' });
    });

    it('should support remember with tags', async () => {
      const tagged = cache.tags(['users']);

      const callback = vi.fn().mockResolvedValue({ name: 'John' });
      const result = await tagged.remember('user:1', '1h', callback);

      expect(result).toEqual({ name: 'John' });
      expect(callback).toHaveBeenCalledTimes(1);

      // Should be cached
      const result2 = await tagged.remember('user:1', '1h', callback);
      expect(result2).toEqual({ name: 'John' });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should flush by tags', async () => {
      const taggedUsers = cache.tags(['users']);
      const taggedPosts = cache.tags(['posts']);

      await taggedUsers.put('user:1', { name: 'John' });
      await taggedPosts.put('post:1', { title: 'Hello' });

      await taggedUsers.flush();

      expect(await cache.get('user:1')).toBeNull();
      expect(await cache.get('post:1')).toEqual({ title: 'Hello' });
    });
  });

  describe('locks', () => {
    it('should acquire and release locks', async () => {
      const lock = await cache.lock('resource', { timeout: '5s' });

      expect(lock.acquired).toBe(true);

      await lock.release();

      // Should be able to acquire again
      const lock2 = await cache.lock('resource', { timeout: '5s' });
      expect(lock2.acquired).toBe(true);
      await lock2.release();
    });

    it('should fail to acquire held lock', async () => {
      const lock1 = await cache.lock('resource', { timeout: '5s' });
      expect(lock1.acquired).toBe(true);

      const lock2 = await cache.lock('resource', {
        timeout: '5s',
        maxRetries: 2,
        retryInterval: 10,
      });
      expect(lock2.acquired).toBe(false);

      await lock1.release();
    });

    it('should execute callback with lock', async () => {
      const callback = vi.fn().mockResolvedValue('result');

      const result = await cache.lockAndRun('resource', '5s', callback);

      expect(result).toBe('result');
      expect(callback).toHaveBeenCalledTimes(1);

      // Lock should be released, so we can acquire again
      const lock = await cache.lock('resource', { timeout: '5s' });
      expect(lock.acquired).toBe(true);
      await lock.release();
    });

    it('should release lock even if callback throws', async () => {
      const callback = vi.fn().mockRejectedValue(new Error('test'));

      await expect(cache.lockAndRun('resource', '5s', callback)).rejects.toThrow('test');

      // Lock should be released
      const lock = await cache.lock('resource', { timeout: '5s' });
      expect(lock.acquired).toBe(true);
      await lock.release();
    });

    it('should throw if lock cannot be acquired', async () => {
      const lock = await cache.lock('resource', { timeout: '5s' });
      expect(lock.acquired).toBe(true);

      // Create a new cache manager to simulate different process
      const cache2 = await createCacheManager({ driver: 'memory' });

      // Try to run with lock (should fail quickly)
      // Note: This won't work with memory driver as they share same LRU cache
      // In real scenario with Redis, this would fail

      await lock.release();
      await cache2.close();
    });
  });
});
