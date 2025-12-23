import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMemoryCache } from '../drivers/memory.js';
import type { TaggableCacheStore } from '../types.js';

describe('Memory Cache Driver', () => {
  let cache: TaggableCacheStore;

  beforeEach(() => {
    cache = createMemoryCache({ maxSize: 100 });
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

    it('should store and retrieve objects', async () => {
      const user = { id: '123', name: 'John', age: 30 };
      await cache.put('user', user);
      const result = await cache.get('user');
      expect(result).toEqual(user);
    });

    it('should store and retrieve arrays', async () => {
      const items = [1, 2, 3, 'four', { five: 5 }];
      await cache.put('items', items);
      const result = await cache.get('items');
      expect(result).toEqual(items);
    });

    it('should store and retrieve dates', async () => {
      const date = new Date('2025-01-01');
      await cache.put('date', date);
      const result = await cache.get<Date>('date');
      expect(result).toEqual(date);
    });

    it('should return null for missing keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should check key existence', async () => {
      await cache.put('exists', 'value');

      expect(await cache.has('exists')).toBe(true);
      expect(await cache.has('notexists')).toBe(false);
    });

    it('should delete keys', async () => {
      await cache.put('key', 'value');
      expect(await cache.has('key')).toBe(true);

      const deleted = await cache.forget('key');
      expect(deleted).toBe(true);
      expect(await cache.has('key')).toBe(false);
    });

    it('should return false when deleting nonexistent key', async () => {
      const deleted = await cache.forget('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('TTL handling', () => {
    it('should expire entries after TTL', async () => {
      await cache.put('expiring', 'value', '1s');
      expect(await cache.get('expiring')).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(await cache.get('expiring')).toBeNull();
    });

    it('should support numeric TTL in seconds', async () => {
      await cache.put('expiring', 'value', 1);
      expect(await cache.get('expiring')).toBe('value');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(await cache.get('expiring')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      const shortCache = createMemoryCache({ defaultTtl: '1s' });
      await shortCache.put('key', 'value');

      expect(await shortCache.get('key')).toBe('value');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(await shortCache.get('key')).toBeNull();
      await shortCache.close();
    });
  });

  describe('increment/decrement', () => {
    it('should increment values', async () => {
      const result1 = await cache.increment('counter');
      expect(result1).toBe(1);

      const result2 = await cache.increment('counter');
      expect(result2).toBe(2);

      const result3 = await cache.increment('counter', 5);
      expect(result3).toBe(7);
    });

    it('should decrement values', async () => {
      await cache.put('counter', 10);

      const result1 = await cache.decrement('counter');
      expect(result1).toBe(9);

      const result2 = await cache.decrement('counter', 3);
      expect(result2).toBe(6);
    });

    it('should preserve tags when incrementing tagged values', async () => {
      // Put a tagged value
      await cache.putWithTags('views:page:1', 0, ['views', 'page:1']);

      // Increment should preserve tags
      await cache.increment('views:page:1');
      await cache.increment('views:page:1');

      // Value should be incremented
      expect(await cache.get('views:page:1')).toBe(2);

      // Flushing the tag should remove the key
      await cache.flushTags(['views']);
      expect(await cache.get('views:page:1')).toBeNull();
    });

    it('should preserve tags when decrementing tagged values', async () => {
      // Put a tagged value
      await cache.putWithTags('stock:item:1', 100, ['inventory', 'item:1']);

      // Decrement should preserve tags
      await cache.decrement('stock:item:1');
      await cache.decrement('stock:item:1', 5);

      // Value should be decremented
      expect(await cache.get('stock:item:1')).toBe(94);

      // Flushing the tag should remove the key
      await cache.flushTags(['inventory']);
      expect(await cache.get('stock:item:1')).toBeNull();
    });

    it('should handle increment on expired key as new key', async () => {
      const shortCache = createMemoryCache({ defaultTtl: '1s' });
      await shortCache.put('expiring-counter', 100);

      expect(await shortCache.get('expiring-counter')).toBe(100);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Increment on expired key should start from 0
      const result = await shortCache.increment('expiring-counter');
      expect(result).toBe(1);

      await shortCache.close();
    });

    it('should handle decrement on expired key as new key', async () => {
      const shortCache = createMemoryCache({ defaultTtl: '1s' });
      await shortCache.put('expiring-counter', 100);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Decrement on expired key should start from 0
      const result = await shortCache.decrement('expiring-counter');
      expect(result).toBe(-1);

      await shortCache.close();
    });

    it('should support negative increments', async () => {
      await cache.put('counter', 10);

      const result = await cache.increment('counter', -3);
      expect(result).toBe(7);
    });

    it('should support negative decrements', async () => {
      await cache.put('counter', 10);

      const result = await cache.decrement('counter', -5);
      expect(result).toBe(15); // Subtracting a negative is adding
    });
  });

  describe('bulk operations', () => {
    it('should get multiple values', async () => {
      await cache.put('key1', 'value1');
      await cache.put('key2', 'value2');

      const results = await cache.many(['key1', 'key2', 'key3']);

      expect(results.get('key1')).toBe('value1');
      expect(results.get('key2')).toBe('value2');
      expect(results.get('key3')).toBeNull();
    });

    it('should put multiple values', async () => {
      const entries = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3'],
      ]);

      await cache.putMany(entries);

      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
      expect(await cache.get('key3')).toBe('value3');
    });

    it('should handle empty key array for many()', async () => {
      const results = await cache.many([]);
      expect(results.size).toBe(0);
    });

    it('should handle empty map for putMany()', async () => {
      await cache.putMany(new Map());
      // Should not throw and cache should remain unchanged
      expect(await cache.get('nonexistent')).toBeNull();
    });

    it('should handle large batch with many()', async () => {
      // Create 100 entries
      const entries = new Map<string, { id: number }>();
      for (let i = 0; i < 100; i++) {
        entries.set(`item:${i}`, { id: i });
      }
      await cache.putMany(entries);

      // Retrieve all at once (tests parallel execution)
      const keys = Array.from({ length: 100 }, (_, i) => `item:${i}`);
      const results = await cache.many<{ id: number }>(keys);

      expect(results.size).toBe(100);
      for (let i = 0; i < 100; i++) {
        expect(results.get(`item:${i}`)).toEqual({ id: i });
      }
    });

    it('should handle large batch with putMany()', async () => {
      // Create 100 entries
      const entries = new Map<string, { value: number }>();
      for (let i = 0; i < 100; i++) {
        entries.set(`bulk:${i}`, { value: i * 10 });
      }

      await cache.putMany(entries);

      // Verify all were stored
      for (let i = 0; i < 100; i++) {
        expect(await cache.get(`bulk:${i}`)).toEqual({ value: i * 10 });
      }
    });

    it('should preserve value types in many()', async () => {
      await cache.put('string', 'hello');
      await cache.put('number', 42);
      await cache.put('object', { nested: { deep: true } });
      await cache.put('array', [1, 2, 3]);
      await cache.put('boolean', true);

      const results = await cache.many(['string', 'number', 'object', 'array', 'boolean']);

      expect(results.get('string')).toBe('hello');
      expect(results.get('number')).toBe(42);
      expect(results.get('object')).toEqual({ nested: { deep: true } });
      expect(results.get('array')).toEqual([1, 2, 3]);
      expect(results.get('boolean')).toBe(true);
    });

    it('should apply TTL to all entries in putMany()', async () => {
      const shortCache = createMemoryCache({ defaultTtl: '1h' });

      const entries = new Map([
        ['exp1', 'value1'],
        ['exp2', 'value2'],
      ]);

      // Use a short TTL
      await shortCache.putMany(entries, '1s');

      expect(await shortCache.get('exp1')).toBe('value1');
      expect(await shortCache.get('exp2')).toBe('value2');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(await shortCache.get('exp1')).toBeNull();
      expect(await shortCache.get('exp2')).toBeNull();

      await shortCache.close();
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
    it('should store values with tags', async () => {
      await cache.putWithTags('user:1', { name: 'John' }, ['users']);
      await cache.putWithTags('user:2', { name: 'Jane' }, ['users']);

      expect(await cache.get('user:1')).toEqual({ name: 'John' });
      expect(await cache.get('user:2')).toEqual({ name: 'Jane' });
    });

    it('should flush entries by tag', async () => {
      await cache.putWithTags('user:1', { name: 'John' }, ['users']);
      await cache.putWithTags('user:2', { name: 'Jane' }, ['users']);
      await cache.put('other', 'value'); // No tag

      await cache.flushTags(['users']);

      expect(await cache.get('user:1')).toBeNull();
      expect(await cache.get('user:2')).toBeNull();
      expect(await cache.get('other')).toBe('value'); // Should remain
    });

    it('should support multiple tags', async () => {
      await cache.putWithTags('user:1', { name: 'John' }, ['users', 'active']);
      await cache.putWithTags('user:2', { name: 'Jane' }, ['users', 'inactive']);

      // Flush by 'active' tag
      await cache.flushTags(['active']);

      expect(await cache.get('user:1')).toBeNull(); // Flushed
      expect(await cache.get('user:2')).toEqual({ name: 'Jane' }); // Remains
    });

    it('should handle empty tag array', async () => {
      await cache.putWithTags('user:1', { name: 'John' }, ['users']);

      // Flush with empty array should not throw
      await cache.flushTags([]);

      // Value should remain
      expect(await cache.get('user:1')).toEqual({ name: 'John' });
    });

    it('should flush multiple tags at once', async () => {
      await cache.putWithTags('user:1', { name: 'John' }, ['users', 'active']);
      await cache.putWithTags('post:1', { title: 'Hello' }, ['posts', 'featured']);
      await cache.putWithTags('comment:1', { text: 'Nice' }, ['comments']);
      await cache.put('other', 'value'); // No tag

      // Flush multiple tags at once (tests pipeline optimization in Redis)
      await cache.flushTags(['users', 'posts']);

      expect(await cache.get('user:1')).toBeNull(); // Flushed (had 'users' tag)
      expect(await cache.get('post:1')).toBeNull(); // Flushed (had 'posts' tag)
      expect(await cache.get('comment:1')).toEqual({ text: 'Nice' }); // Remains
      expect(await cache.get('other')).toBe('value'); // Remains (no tag)
    });

    it('should handle non-existent tags gracefully', async () => {
      await cache.putWithTags('user:1', { name: 'John' }, ['users']);

      // Flush tags that don't exist should not throw
      await cache.flushTags(['nonexistent', 'also-nonexistent']);

      // Original value should remain
      expect(await cache.get('user:1')).toEqual({ name: 'John' });
    });

    it('should handle duplicate keys across tags', async () => {
      // Same key tagged with multiple tags
      await cache.putWithTags('user:1', { name: 'John' }, ['users', 'active', 'admins']);

      // Flush all tags that contain this key
      await cache.flushTags(['users', 'active', 'admins']);

      // Key should be deleted only once (no errors from duplicate deletion)
      expect(await cache.get('user:1')).toBeNull();
    });
  });
});
