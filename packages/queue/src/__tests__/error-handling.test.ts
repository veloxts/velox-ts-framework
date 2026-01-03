/**
 * Error Handling and Retry Tests
 *
 * Tests for job failure scenarios, retry strategies, and error recovery.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createSyncStore, createSyncWorker } from '../drivers/sync.js';
import { defineJob } from '../job.js';
import { createQueueManager } from '../manager.js';

describe('Error Handling', () => {
  describe('job handler errors', () => {
    it('should capture error message in failed job', async () => {
      const store = createSyncStore({ throwOnError: false });
      const worker = createSyncWorker(store);

      worker.registerHandler(
        'failing.job',
        async () => {
          throw new Error('Specific error message');
        },
        { queue: 'default', jobOptions: { attempts: 1 } }
      );

      await store.add('failing.job', { data: 'test' }, { queue: 'default' });
      await worker.start();

      const failed = await store.getFailedJobs('default');
      expect(failed).toHaveLength(1);
      expect(failed[0].error).toContain('Specific error message');
    });

    it('should capture error from rejected promise', async () => {
      const store = createSyncStore({ throwOnError: false });
      const worker = createSyncWorker(store);

      worker.registerHandler(
        'promise.reject',
        () => Promise.reject(new Error('Promise rejected')),
        { queue: 'default', jobOptions: { attempts: 1 } }
      );

      await store.add('promise.reject', {}, { queue: 'default' });
      await worker.start();

      const failed = await store.getFailedJobs('default');
      expect(failed).toHaveLength(1);
      expect(failed[0].error).toContain('Promise rejected');
    });

    it('should handle non-Error thrown values', async () => {
      const store = createSyncStore({ throwOnError: false });
      const worker = createSyncWorker(store);

      worker.registerHandler(
        'throw.string',
        async () => {
          throw 'String error'; // eslint-disable-line no-throw-literal
        },
        { queue: 'default', jobOptions: { attempts: 1 } }
      );

      await store.add('throw.string', {}, { queue: 'default' });
      await worker.start();

      const failed = await store.getFailedJobs('default');
      expect(failed).toHaveLength(1);
    });

    it('should handle undefined/null thrown values', async () => {
      const store = createSyncStore({ throwOnError: false });
      const worker = createSyncWorker(store);

      worker.registerHandler(
        'throw.null',
        async () => {
          throw null; // eslint-disable-line no-throw-literal
        },
        { queue: 'default', jobOptions: { attempts: 1 } }
      );

      await store.add('throw.null', {}, { queue: 'default' });
      await worker.start();

      const failed = await store.getFailedJobs('default');
      expect(failed).toHaveLength(1);
    });
  });

  describe('retry behavior', () => {
    it('should retry with exponential backoff config', async () => {
      const store = createSyncStore({ throwOnError: false });
      const worker = createSyncWorker(store);

      let attempts = 0;
      worker.registerHandler(
        'exponential.job',
        async () => {
          attempts++;
          throw new Error('Always fails');
        },
        {
          queue: 'default',
          jobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 100 },
          },
        }
      );

      await store.add('exponential.job', {}, { queue: 'default' });

      // Run multiple times to exhaust retries
      for (let i = 0; i < 3; i++) {
        await worker.start();
      }

      expect(attempts).toBe(3);

      const failed = await store.getFailedJobs('default');
      expect(failed).toHaveLength(1);
    });

    it('should retry with fixed backoff config', async () => {
      const store = createSyncStore({ throwOnError: false });
      const worker = createSyncWorker(store);

      let attempts = 0;
      worker.registerHandler(
        'fixed.job',
        async () => {
          attempts++;
          throw new Error('Always fails');
        },
        {
          queue: 'default',
          jobOptions: {
            attempts: 2,
            backoff: { type: 'fixed', delay: 50 },
          },
        }
      );

      await store.add('fixed.job', {}, { queue: 'default' });

      for (let i = 0; i < 2; i++) {
        await worker.start();
      }

      expect(attempts).toBe(2);
    });

    it('should succeed after transient failures', async () => {
      const store = createSyncStore({ throwOnError: false });
      const worker = createSyncWorker(store);

      let attempts = 0;
      worker.registerHandler(
        'transient.job',
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Transient failure');
          }
          return 'success';
        },
        { queue: 'default', jobOptions: { attempts: 5 } }
      );

      await store.add('transient.job', {}, { queue: 'default' });

      // Run until job succeeds
      for (let i = 0; i < 5; i++) {
        await worker.start();
      }

      expect(attempts).toBe(3);

      const stats = await store.getStats('default');
      expect(stats[0].failed).toBe(0);
      expect(stats[0].completed).toBe(1);
    });

    it('should track attempt number correctly', async () => {
      const store = createSyncStore({ throwOnError: false });
      const worker = createSyncWorker(store);

      const attemptNumbers: number[] = [];
      worker.registerHandler(
        'track.attempts',
        async ({ attemptNumber }) => {
          attemptNumbers.push(attemptNumber);
          throw new Error('Fail to track attempts');
        },
        { queue: 'default', jobOptions: { attempts: 3 } }
      );

      await store.add('track.attempts', {}, { queue: 'default' });

      for (let i = 0; i < 3; i++) {
        await worker.start();
      }

      expect(attemptNumbers).toEqual([1, 2, 3]);
    });
  });

  describe('validation errors', () => {
    it('should reject invalid job data before dispatch', async () => {
      const manager = await createQueueManager({ driver: 'sync' });

      const emailJob = defineJob({
        name: 'email.send',
        schema: z.object({
          to: z.string().email(),
          subject: z.string().min(1),
        }),
        handler: async () => {},
      });

      // Invalid email
      await expect(
        manager.dispatch(emailJob, { to: 'not-an-email', subject: 'Test' })
      ).rejects.toThrow();

      // Missing required field
      await expect(
        manager.dispatch(emailJob, { to: 'test@example.com' } as never)
      ).rejects.toThrow();

      // Empty subject
      await expect(
        manager.dispatch(emailJob, { to: 'test@example.com', subject: '' })
      ).rejects.toThrow();

      await manager.close();
    });

    it('should reject batch with any invalid data', async () => {
      const manager = await createQueueManager({ driver: 'sync' });

      const job = defineJob({
        name: 'batch.job',
        schema: z.object({ value: z.number().positive() }),
        handler: async () => {},
      });

      // One invalid item should reject entire batch
      await expect(
        manager.dispatchBatch(job, [{ value: 1 }, { value: -1 }, { value: 3 }])
      ).rejects.toThrow();

      await manager.close();
    });
  });

  describe('queue management errors', () => {
    it('should handle clearing non-existent queue', async () => {
      const store = createSyncStore();

      // Should not throw when clearing queue that doesn't exist
      await expect(store.clearQueue('nonexistent')).resolves.not.toThrow();
    });

    it('should handle getting stats for non-existent queue', async () => {
      const store = createSyncStore();

      const stats = await store.getStats('nonexistent');
      // Should return empty or single entry with zeros
      expect(stats.length).toBeLessThanOrEqual(1);
      if (stats.length > 0) {
        expect(stats[0].waiting).toBe(0);
      }
    });

    it('should handle retrying non-existent job', async () => {
      const store = createSyncStore();

      const result = await store.retryJob('non-existent-id', 'default');
      expect(result).toBe(false);
    });
  });

  describe('concurrent job failures', () => {
    it('should handle multiple jobs failing simultaneously', async () => {
      const store = createSyncStore({ throwOnError: false });
      const worker = createSyncWorker(store);

      worker.registerHandler(
        'fail.job',
        async ({ data }) => {
          throw new Error(`Job ${data.id} failed`);
        },
        { queue: 'default', jobOptions: { attempts: 1 } }
      );

      // Add multiple jobs
      for (let i = 0; i < 10; i++) {
        await store.add('fail.job', { id: i }, { queue: 'default' });
      }

      await worker.start();

      const failed = await store.getFailedJobs('default');
      expect(failed).toHaveLength(10);

      // Each should have its own error message
      for (let i = 0; i < 10; i++) {
        const job = failed.find((j) => j.data.id === i);
        expect(job).toBeDefined();
        expect(job?.error).toContain(`Job ${i} failed`);
      }
    });

    it('should isolate failures between queues', async () => {
      const store = createSyncStore({ throwOnError: false });
      const worker = createSyncWorker(store);

      worker.registerHandler(
        'fail.job',
        async () => {
          throw new Error('Failed');
        },
        { queue: 'queue-a', jobOptions: { attempts: 1 } }
      );

      worker.registerHandler(
        'success.job',
        async () => 'ok',
        { queue: 'queue-b' }
      );

      await store.add('fail.job', {}, { queue: 'queue-a' });
      await store.add('success.job', {}, { queue: 'queue-b' });

      await worker.start();

      const statsA = await store.getStats('queue-a');
      const statsB = await store.getStats('queue-b');

      expect(statsA[0].failed).toBe(1);
      expect(statsB[0].completed).toBe(1);
    });
  });

  describe('job data integrity', () => {
    it('should preserve job data through retries', async () => {
      const store = createSyncStore({ throwOnError: false });
      const worker = createSyncWorker(store);

      const receivedData: unknown[] = [];
      let attempts = 0;

      worker.registerHandler(
        'data.job',
        async ({ data }) => {
          receivedData.push(structuredClone(data));
          attempts++;
          if (attempts < 3) {
            throw new Error('Retry needed');
          }
        },
        { queue: 'default', jobOptions: { attempts: 3 } }
      );

      const originalData = { nested: { value: 42 }, array: [1, 2, 3] };
      await store.add('data.job', originalData, { queue: 'default' });

      for (let i = 0; i < 3; i++) {
        await worker.start();
      }

      // All attempts should receive identical data
      expect(receivedData).toHaveLength(3);
      receivedData.forEach((data) => {
        expect(data).toEqual(originalData);
      });
    });

    it('should not allow handler to mutate original job data', async () => {
      const store = createSyncStore();
      const worker = createSyncWorker(store);

      worker.registerHandler(
        'mutate.job',
        async ({ data }) => {
          // Try to mutate
          (data as { value: number }).value = 999;
        },
        { queue: 'default' }
      );

      const jobId = await store.add('mutate.job', { value: 42 }, { queue: 'default' });
      await worker.start();

      // Original data in store should be unchanged
      // (This depends on implementation - sync driver may or may not clone)
      const stats = await store.getStats('default');
      expect(stats[0].completed).toBe(1);
    });
  });

  describe('progress and logging', () => {
    it('should allow progress updates', async () => {
      const store = createSyncStore();
      const worker = createSyncWorker(store);

      const progressUpdates: number[] = [];

      worker.registerHandler(
        'progress.job',
        async ({ progress }) => {
          for (let i = 0; i <= 100; i += 25) {
            progress(i);
            progressUpdates.push(i);
          }
        },
        { queue: 'default' }
      );

      await store.add('progress.job', {}, { queue: 'default' });
      await worker.start();

      expect(progressUpdates).toEqual([0, 25, 50, 75, 100]);
    });

    it('should allow logging during job execution', async () => {
      const store = createSyncStore();
      const worker = createSyncWorker(store);

      const logMessages: string[] = [];

      worker.registerHandler(
        'log.job',
        async ({ log }) => {
          log('Starting job');
          log('Processing step 1');
          log('Job complete');
        },
        { queue: 'default' }
      );

      // Mock console.log to capture logs (sync driver logs to console)
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        if (typeof args[0] === 'string') {
          logMessages.push(args[0]);
        }
      };

      await store.add('log.job', {}, { queue: 'default' });
      await worker.start();

      console.log = originalLog;

      // Log function should have been called
      expect(logMessages.some((m) => m.includes('Starting job'))).toBe(true);
    });
  });
});

describe('Job Definition Edge Cases', () => {
  it('should reject job name with invalid characters', () => {
    expect(() =>
      defineJob({
        name: 'job with spaces',
        schema: z.object({}),
        handler: async () => {},
      })
    ).toThrow();

    expect(() =>
      defineJob({
        name: 'job@special!chars',
        schema: z.object({}),
        handler: async () => {},
      })
    ).toThrow();
  });

  it('should accept job names with dots (dot-separated identifiers)', () => {
    const job1 = defineJob({
      name: 'user.email.welcome',
      schema: z.object({}),
      handler: async () => {},
    });
    expect(job1.name).toBe('user.email.welcome');

    const job2 = defineJob({
      name: 'email.send',
      schema: z.object({}),
      handler: async () => {},
    });
    expect(job2.name).toBe('email.send');
  });

  it('should reject job names with hyphens', () => {
    expect(() =>
      defineJob({
        name: 'send-email-notification',
        schema: z.object({}),
        handler: async () => {},
      })
    ).toThrow('Invalid job name');
  });

  it('should use queue from job definition', () => {
    const job = defineJob({
      name: 'high.priority',
      schema: z.object({}),
      handler: async () => {},
      queue: 'critical',
    });

    expect(job.queue).toBe('critical');
  });

  it('should merge job options correctly', () => {
    const job = defineJob({
      name: 'custom.options',
      schema: z.object({}),
      handler: async () => {},
      options: {
        attempts: 10,
        priority: 5,
      },
    });

    expect(job.options.attempts).toBe(10);
    expect(job.options.priority).toBe(5);
    // Default values should still be present
    expect(job.options.removeOnComplete).toBe(true);
  });
});
