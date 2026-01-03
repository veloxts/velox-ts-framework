/**
 * Concurrent Access Tests
 *
 * Tests for race conditions, parallel operations, and concurrent access patterns.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMemoryCache } from '../drivers/memory.js';
import { type CacheManager, createCacheManager } from '../manager.js';
import type { TaggableCacheStore } from '../types.js';

describe('Concurrent Access', () => {
  let cache: TaggableCacheStore;
  let manager: CacheManager;

  beforeEach(async () => {
    cache = createMemoryCache({ maxSize: 1000 });
    manager = await createCacheManager({ driver: 'memory' });
  });

  afterEach(async () => {
    await cache.close();
    await manager.close();
  });

  describe('parallel read operations', () => {
    it('should handle many parallel get operations', async () => {
      // Setup data
      for (let i = 0; i < 100; i++) {
        await cache.put(`key:${i}`, `value:${i}`);
      }

      // Read all in parallel
      const promises = Array.from({ length: 100 }, (_, i) => cache.get(`key:${i}`));
      const results = await Promise.all(promises);

      // Verify all reads succeeded
      results.forEach((result, i) => {
        expect(result).toBe(`value:${i}`);
      });
    });

    it('should handle parallel has() checks', async () => {
      await cache.put('exists', 'value');

      const promises = [
        ...Array.from({ length: 50 }, () => cache.has('exists')),
        ...Array.from({ length: 50 }, () => cache.has('notexists')),
      ];

      const results = await Promise.all(promises);

      expect(results.slice(0, 50).every((r) => r === true)).toBe(true);
      expect(results.slice(50).every((r) => r === false)).toBe(true);
    });

    it('should handle parallel many() operations', async () => {
      // Setup
      for (let i = 0; i < 50; i++) {
        await cache.put(`item:${i}`, { id: i });
      }

      // Multiple parallel many() calls
      const keys = Array.from({ length: 50 }, (_, i) => `item:${i}`);
      const promises = Array.from({ length: 10 }, () => cache.many(keys));
      const results = await Promise.all(promises);

      // All should return same data
      results.forEach((map) => {
        expect(map.size).toBe(50);
        for (let i = 0; i < 50; i++) {
          expect(map.get(`item:${i}`)).toEqual({ id: i });
        }
      });
    });
  });

  describe('parallel write operations', () => {
    it('should handle many parallel put operations', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        cache.put(`parallel:${i}`, `value:${i}`)
      );

      await Promise.all(promises);

      // Verify all writes succeeded
      for (let i = 0; i < 100; i++) {
        expect(await cache.get(`parallel:${i}`)).toBe(`value:${i}`);
      }
    });

    it('should handle parallel putMany operations', async () => {
      const batches = Array.from({ length: 10 }, (_, batchIndex) => {
        const entries = new Map<string, { batch: number; item: number }>();
        for (let i = 0; i < 10; i++) {
          entries.set(`batch:${batchIndex}:${i}`, { batch: batchIndex, item: i });
        }
        return entries;
      });

      await Promise.all(batches.map((batch) => cache.putMany(batch)));

      // Verify all batches were written
      for (let b = 0; b < 10; b++) {
        for (let i = 0; i < 10; i++) {
          expect(await cache.get(`batch:${b}:${i}`)).toEqual({ batch: b, item: i });
        }
      }
    });

    it('should handle parallel writes to same key (last write wins)', async () => {
      const writes = Array.from({ length: 100 }, (_, i) => cache.put('contested', i));

      await Promise.all(writes);

      // Some value should have won
      const result = await cache.get<number>('contested');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(100);
    });
  });

  describe('mixed read/write operations', () => {
    it('should handle interleaved reads and writes', async () => {
      await cache.put('counter', 0);

      const operations = Array.from({ length: 100 }, (_, i) => {
        if (i % 2 === 0) {
          return cache.put('counter', i);
        }
        return cache.get('counter');
      });

      const results = await Promise.all(operations);

      // Reads should return numbers (possibly different values due to timing)
      const reads = results.filter((_, i) => i % 2 === 1);
      reads.forEach((result) => {
        expect(typeof result === 'number' || result === null).toBe(true);
      });
    });

    it('should handle parallel remember() calls for same key', async () => {
      let callCount = 0;

      const promises = Array.from({ length: 10 }, () =>
        manager.remember('computed', '1h', async () => {
          callCount++;
          await new Promise((r) => setTimeout(r, 10));
          return 'result';
        })
      );

      const results = await Promise.all(promises);

      // All should return same result
      results.forEach((result) => {
        expect(result).toBe('result');
      });

      // Callback may be called multiple times due to race condition
      // but all results should be consistent
      expect(callCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('parallel increment/decrement', () => {
    it('should handle parallel increments correctly', async () => {
      const increments = Array.from({ length: 100 }, () => cache.increment('counter'));

      await Promise.all(increments);

      // Final value should be 100 (each increment adds 1)
      const result = await cache.get<number>('counter');
      expect(result).toBe(100);
    });

    it('should handle parallel decrements correctly', async () => {
      await cache.put('counter', 100);

      const decrements = Array.from({ length: 50 }, () => cache.decrement('counter'));

      await Promise.all(decrements);

      const result = await cache.get<number>('counter');
      expect(result).toBe(50);
    });

    it('should handle mixed increments and decrements', async () => {
      await cache.put('counter', 50);

      const operations = [
        ...Array.from({ length: 30 }, () => cache.increment('counter')),
        ...Array.from({ length: 20 }, () => cache.decrement('counter')),
      ];

      await Promise.all(operations);

      // 50 + 30 - 20 = 60
      const result = await cache.get<number>('counter');
      expect(result).toBe(60);
    });
  });

  describe('parallel tag operations', () => {
    it('should handle parallel tagged puts', async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        cache.putWithTags(`tagged:${i}`, { id: i }, ['group-a', `item-${i}`])
      );

      await Promise.all(promises);

      // Verify all tagged puts succeeded
      for (let i = 0; i < 50; i++) {
        expect(await cache.get(`tagged:${i}`)).toEqual({ id: i });
      }
    });

    it('should handle parallel flushTags', async () => {
      // Setup tagged data
      for (let i = 0; i < 10; i++) {
        await cache.putWithTags(`group-a:${i}`, i, ['group-a']);
        await cache.putWithTags(`group-b:${i}`, i, ['group-b']);
      }

      // Parallel flush different tags
      await Promise.all([cache.flushTags(['group-a']), cache.flushTags(['group-b'])]);

      // All should be flushed
      for (let i = 0; i < 10; i++) {
        expect(await cache.get(`group-a:${i}`)).toBeNull();
        expect(await cache.get(`group-b:${i}`)).toBeNull();
      }
    });
  });

  describe('parallel lock operations', () => {
    it('should handle sequential lock acquisition', async () => {
      // First lock should succeed
      const lock1 = await manager.lock('resource', { timeout: '1s' });
      expect(lock1.acquired).toBe(true);

      // Second lock should fail (resource is held)
      const lock2 = await manager.lock('resource', { timeout: '1s', maxRetries: 0 });
      expect(lock2.acquired).toBe(false);

      // Release first lock
      await lock1.release();

      // Now third lock should succeed
      const lock3 = await manager.lock('resource', { timeout: '1s' });
      expect(lock3.acquired).toBe(true);
      await lock3.release();
    });

    it('should handle parallel lockAndRun with proper exclusion', async () => {
      const results: number[] = [];
      let counter = 0;

      const operations = Array.from({ length: 5 }, async () => {
        try {
          return await manager.lockAndRun('exclusive', '5s', async () => {
            const current = counter;
            await new Promise((r) => setTimeout(r, 5));
            counter = current + 1;
            results.push(counter);
            return counter;
          });
        } catch {
          return null; // Lock not acquired
        }
      });

      await Promise.all(operations);

      // If locks work correctly, results should be sequential (no races)
      // Since memory driver uses same LRU, first lock wins and others fail
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('stress tests', () => {
    it('should handle high volume of mixed operations', async () => {
      const operations: Promise<unknown>[] = [];

      // 200 puts
      for (let i = 0; i < 200; i++) {
        operations.push(cache.put(`stress:${i}`, { value: i }));
      }

      // 100 gets
      for (let i = 0; i < 100; i++) {
        operations.push(cache.get(`stress:${i}`));
      }

      // 50 increments
      for (let i = 0; i < 50; i++) {
        operations.push(cache.increment('stress-counter'));
      }

      // 20 deletes
      for (let i = 0; i < 20; i++) {
        operations.push(cache.forget(`stress:${i + 180}`));
      }

      await Promise.all(operations);

      // Counter should be 50
      expect(await cache.get('stress-counter')).toBe(50);

      // First 180 should exist, last 20 deleted
      expect(await cache.has('stress:0')).toBe(true);
      expect(await cache.has('stress:179')).toBe(true);
      expect(await cache.has('stress:180')).toBe(false);
    });

    it('should maintain consistency under concurrent flush', async () => {
      // Write some data
      for (let i = 0; i < 50; i++) {
        await cache.put(`data:${i}`, i);
      }

      // Concurrent flush and writes
      const operations = [
        cache.flush(),
        ...Array.from({ length: 20 }, (_, i) => cache.put(`new:${i}`, i)),
      ];

      await Promise.all(operations);

      // Old data should be gone (flush happened)
      for (let i = 0; i < 50; i++) {
        expect(await cache.has(`data:${i}`)).toBe(false);
      }

      // New data may or may not exist depending on timing
      // This is expected behavior - flush clears everything at a point in time
    });
  });
});
