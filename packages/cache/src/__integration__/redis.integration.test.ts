/**
 * Redis Cache Driver Integration Tests
 *
 * These tests run against a real Redis instance using testcontainers.
 * They verify the Redis driver works correctly with actual Redis.
 *
 * Run with: pnpm test:integration (or pnpm test to run all tests)
 */

import {
  isDockerAvailable,
  type RedisContainerResult,
  startRedisContainer,
} from '@veloxts/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createRedisCache } from '../drivers/redis.js';
import type { TaggableCacheStore } from '../types.js';

// Check Docker availability at module load time
const dockerAvailable = await isDockerAvailable();

// Skip entire suite if Docker is not available
const describeIntegration = dockerAvailable ? describe : describe.skip;

describeIntegration('Redis cache driver (integration)', () => {
  let redis: RedisContainerResult;
  let cache: TaggableCacheStore;

  beforeAll(async () => {
    // Start Redis container (takes ~2-3 seconds)
    redis = await startRedisContainer();

    // Create cache instance connected to the container
    cache = await createRedisCache({
      url: redis.url,
      prefix: 'test:',
    });
  }, 30000); // 30s timeout for container startup

  afterAll(async () => {
    // Clean up with try/catch to prevent test hangs on cleanup failures
    try {
      if (cache) await cache.close();
    } catch {
      /* ignore cleanup errors */
    }
    try {
      if (redis) await redis.stop();
    } catch {
      /* ignore cleanup errors */
    }
  });

  // ==========================================================================
  // Basic Operations
  // ==========================================================================

  describe('basic operations', () => {
    it('should put and get a string value', async () => {
      await cache.put('greeting', 'Hello, Redis!', '1h');
      const result = await cache.get<string>('greeting');
      expect(result).toBe('Hello, Redis!');
    });

    it('should put and get an object value', async () => {
      const user = { id: '123', name: 'John Doe', email: 'john@example.com' };
      await cache.put('user:123', user, '1h');

      const result = await cache.get<typeof user>('user:123');
      expect(result).toEqual(user);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should check if key exists with has()', async () => {
      await cache.put('exists-check', 'value', '1h');

      expect(await cache.has('exists-check')).toBe(true);
      expect(await cache.has('does-not-exist')).toBe(false);
    });

    it('should delete a key with forget()', async () => {
      await cache.put('to-delete', 'value', '1h');
      expect(await cache.has('to-delete')).toBe(true);

      const deleted = await cache.forget('to-delete');
      expect(deleted).toBe(true);
      expect(await cache.has('to-delete')).toBe(false);
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await cache.forget('never-existed');
      expect(deleted).toBe(false);
    });
  });

  // ==========================================================================
  // Increment/Decrement
  // ==========================================================================

  describe('increment/decrement', () => {
    it('should increment a counter from zero', async () => {
      // Redis INCR creates the key at 0 if it doesn't exist
      const result1 = await cache.increment('incr-counter');
      expect(result1).toBe(1);

      const result2 = await cache.increment('incr-counter', 5);
      expect(result2).toBe(6);
    });

    it('should decrement a counter from zero', async () => {
      // Redis DECRBY creates the key at 0 if it doesn't exist
      const result1 = await cache.decrement('decr-counter');
      expect(result1).toBe(-1);

      const result2 = await cache.decrement('decr-counter', 3);
      expect(result2).toBe(-4);
    });
  });

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  describe('batch operations', () => {
    it('should get multiple values with many()', async () => {
      await cache.put('batch:a', 'value-a', '1h');
      await cache.put('batch:b', 'value-b', '1h');
      await cache.put('batch:c', 'value-c', '1h');

      const results = await cache.many<string>(['batch:a', 'batch:b', 'batch:c', 'batch:missing']);

      expect(results.get('batch:a')).toBe('value-a');
      expect(results.get('batch:b')).toBe('value-b');
      expect(results.get('batch:c')).toBe('value-c');
      expect(results.get('batch:missing')).toBeNull();
    });

    it('should put multiple values with putMany()', async () => {
      const entries = new Map<string, string>([
        ['multi:1', 'first'],
        ['multi:2', 'second'],
        ['multi:3', 'third'],
      ]);

      await cache.putMany(entries, '1h');

      expect(await cache.get('multi:1')).toBe('first');
      expect(await cache.get('multi:2')).toBe('second');
      expect(await cache.get('multi:3')).toBe('third');
    });
  });

  // ==========================================================================
  // Add (set if not exists)
  // ==========================================================================

  describe('add operation', () => {
    it('should add value only if key does not exist', async () => {
      // First add should succeed
      const first = await cache.add('add-test', 'first-value', '1h');
      expect(first).toBe(true);
      expect(await cache.get('add-test')).toBe('first-value');

      // Second add should fail (key already exists)
      const second = await cache.add('add-test', 'second-value', '1h');
      expect(second).toBe(false);
      expect(await cache.get('add-test')).toBe('first-value'); // Still first value
    });
  });

  // ==========================================================================
  // Tag Operations
  // ==========================================================================

  describe('tag operations', () => {
    it('should put value with tags', async () => {
      await cache.putWithTags('tagged:1', { data: 'value1' }, ['users', 'active'], '1h');
      await cache.putWithTags('tagged:2', { data: 'value2' }, ['users'], '1h');
      await cache.putWithTags('tagged:3', { data: 'value3' }, ['posts'], '1h');

      // All values should be retrievable
      expect(await cache.get('tagged:1')).toEqual({ data: 'value1' });
      expect(await cache.get('tagged:2')).toEqual({ data: 'value2' });
      expect(await cache.get('tagged:3')).toEqual({ data: 'value3' });
    });

    it('should flush all values with a specific tag', async () => {
      // Create fresh tagged entries
      await cache.putWithTags('flush:1', 'user1', ['flushable', 'users'], '1h');
      await cache.putWithTags('flush:2', 'user2', ['flushable'], '1h');
      await cache.putWithTags('flush:3', 'post1', ['posts'], '1h');

      // Flush the 'flushable' tag
      await cache.flushTags(['flushable']);

      // Tagged entries should be gone
      expect(await cache.get('flush:1')).toBeNull();
      expect(await cache.get('flush:2')).toBeNull();

      // Non-tagged entry should remain
      expect(await cache.get('flush:3')).toBe('post1');
    });

    it('should flush multiple tags at once', async () => {
      await cache.putWithTags('multi-tag:1', 'a', ['tag-a'], '1h');
      await cache.putWithTags('multi-tag:2', 'b', ['tag-b'], '1h');
      await cache.putWithTags('multi-tag:3', 'c', ['tag-c'], '1h');

      // Flush tag-a and tag-b
      await cache.flushTags(['tag-a', 'tag-b']);

      expect(await cache.get('multi-tag:1')).toBeNull();
      expect(await cache.get('multi-tag:2')).toBeNull();
      expect(await cache.get('multi-tag:3')).toBe('c'); // tag-c not flushed
    });
  });

  // ==========================================================================
  // Flush All
  // ==========================================================================

  describe('flush all', () => {
    it('should flush all keys with the configured prefix', async () => {
      // Add some test data
      await cache.put('flush-all:1', 'one', '1h');
      await cache.put('flush-all:2', 'two', '1h');
      await cache.put('flush-all:3', 'three', '1h');

      // Verify they exist
      expect(await cache.has('flush-all:1')).toBe(true);
      expect(await cache.has('flush-all:2')).toBe(true);
      expect(await cache.has('flush-all:3')).toBe(true);

      // Flush all
      await cache.flush();

      // Verify they're gone
      expect(await cache.has('flush-all:1')).toBe(false);
      expect(await cache.has('flush-all:2')).toBe(false);
      expect(await cache.has('flush-all:3')).toBe(false);
    });
  });

  // ==========================================================================
  // TTL (Time-To-Live)
  // ==========================================================================

  describe('TTL expiration', () => {
    it('should expire keys after TTL', async () => {
      // Set a key with 1 second TTL
      await cache.put('expiring', 'temporary', 1);

      // Should exist immediately
      expect(await cache.get('expiring')).toBe('temporary');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Should be gone now
      expect(await cache.get('expiring')).toBeNull();
    }, 5000); // 5s timeout for this test
  });

  // ==========================================================================
  // Complex Data Types
  // ==========================================================================

  describe('complex data types (SuperJSON)', () => {
    it('should handle Date objects', async () => {
      const now = new Date();
      await cache.put('date-test', now, '1h');

      const result = await cache.get<Date>('date-test');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(now.getTime());
    });

    it('should handle Map objects', async () => {
      const map = new Map([
        ['a', 1],
        ['b', 2],
      ]);
      await cache.put('map-test', map, '1h');

      const result = await cache.get<Map<string, number>>('map-test');
      expect(result).toBeInstanceOf(Map);
      expect(result?.get('a')).toBe(1);
      expect(result?.get('b')).toBe(2);
    });

    it('should handle Set objects', async () => {
      const set = new Set([1, 2, 3]);
      await cache.put('set-test', set, '1h');

      const result = await cache.get<Set<number>>('set-test');
      expect(result).toBeInstanceOf(Set);
      expect(result?.has(1)).toBe(true);
      expect(result?.has(2)).toBe(true);
      expect(result?.has(3)).toBe(true);
    });

    it('should handle nested objects with special types', async () => {
      const complex = {
        createdAt: new Date(),
        tags: new Set(['a', 'b']),
        metadata: new Map([['key', 'value']]),
        nested: {
          date: new Date('2025-01-01'),
        },
      };
      await cache.put('complex-test', complex, '1h');

      const result = await cache.get<typeof complex>('complex-test');
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.tags).toBeInstanceOf(Set);
      expect(result?.metadata).toBeInstanceOf(Map);
      expect(result?.nested.date).toBeInstanceOf(Date);
    });
  });
});
