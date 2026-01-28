/**
 * BullMQ Queue Driver Integration Tests
 *
 * These tests run against a real Redis instance using testcontainers.
 * They verify the BullMQ driver works correctly with real Redis.
 *
 * Run with: pnpm test:integration (or pnpm test to run all tests)
 */

import {
  isDockerAvailable,
  type RedisContainerResult,
  startRedisContainer,
} from '@veloxts/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createBullMQStore, createBullMQWorker } from '../drivers/bullmq.js';
import type { QueueStore, WorkerStore } from '../types.js';

// Check Docker availability at module load time
const dockerAvailable = await isDockerAvailable();

// Skip in CI environments (image pulls are slow) or if Docker is not available
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const describeIntegration = dockerAvailable && !isCI ? describe : describe.skip;

describeIntegration('BullMQ queue driver (integration)', () => {
  let redis: RedisContainerResult;
  let store: QueueStore;
  let worker: WorkerStore;

  beforeAll(async () => {
    // Start Redis container (takes ~2-3 seconds)
    redis = await startRedisContainer();
  }, 30000); // 30s timeout for container startup

  afterAll(async () => {
    // Clean up in reverse order with try/catch to prevent test hangs
    try {
      if (worker) await worker.close();
    } catch {
      /* ignore cleanup errors */
    }
    try {
      if (store) await store.close();
    } catch {
      /* ignore cleanup errors */
    }
    try {
      if (redis) await redis.stop();
    } catch {
      /* ignore cleanup errors */
    }
  });

  beforeEach(async () => {
    // Create fresh store and worker for each test
    if (store) {
      await store.close();
    }
    if (worker) {
      await worker.close();
    }

    store = await createBullMQStore({
      url: redis.url,
      prefix: 'test:queue:',
    });

    worker = await createBullMQWorker({
      url: redis.url,
      prefix: 'test:queue:',
    });
  });

  // ==========================================================================
  // Job Enqueuing
  // ==========================================================================

  describe('job enqueuing', () => {
    it('should add a job to the queue', async () => {
      const jobId = await store.add('test.job', { message: 'Hello' }, { queue: 'default' });

      expect(jobId).toBeTruthy();
      expect(typeof jobId).toBe('string');
    });

    it('should add a job with delay', async () => {
      const jobId = await store.add(
        'delayed.job',
        { value: 42 },
        { queue: 'default', delay: 1000 }
      );

      expect(jobId).toBeTruthy();

      // Check stats - should be in delayed state
      const stats = await store.getStats('default');
      expect(stats).toHaveLength(1);
      expect(stats[0].delayed).toBeGreaterThanOrEqual(1);
    });

    it('should add multiple jobs in bulk', async () => {
      const jobs = [
        { jobName: 'bulk.job', data: { index: 1 }, options: { queue: 'default' } },
        { jobName: 'bulk.job', data: { index: 2 }, options: { queue: 'default' } },
        { jobName: 'bulk.job', data: { index: 3 }, options: { queue: 'default' } },
      ];

      const jobIds = await store.addBulk(jobs);

      expect(jobIds).toHaveLength(3);
      expect(jobIds.every((id) => typeof id === 'string')).toBe(true);
    });
  });

  // ==========================================================================
  // Queue Statistics
  // ==========================================================================

  describe('queue statistics', () => {
    it('should return stats for a specific queue', async () => {
      // Add some jobs
      await store.add('stats.job', { data: 1 }, { queue: 'stats-queue' });
      await store.add('stats.job', { data: 2 }, { queue: 'stats-queue' });

      const stats = await store.getStats('stats-queue');

      expect(stats).toHaveLength(1);
      expect(stats[0].name).toBe('stats-queue');
      expect(stats[0].waiting).toBe(2);
      expect(stats[0].active).toBe(0);
      expect(stats[0].completed).toBe(0);
      expect(stats[0].failed).toBe(0);
      expect(stats[0].paused).toBe(false);
    });

    it('should return stats for all queues', async () => {
      await store.add('job.a', { data: 'a' }, { queue: 'queue-a' });
      await store.add('job.b', { data: 'b' }, { queue: 'queue-b' });

      const stats = await store.getStats();

      expect(stats.length).toBeGreaterThanOrEqual(2);
      expect(stats.some((s) => s.name === 'queue-a')).toBe(true);
      expect(stats.some((s) => s.name === 'queue-b')).toBe(true);
    });
  });

  // ==========================================================================
  // Queue Control
  // ==========================================================================

  describe('queue control', () => {
    it('should pause and resume a queue', async () => {
      await store.add('pause.job', { data: 1 }, { queue: 'pausable' });

      // Pause the queue
      await store.pauseQueue('pausable');

      let stats = await store.getStats('pausable');
      expect(stats[0].paused).toBe(true);

      // Resume the queue
      await store.resumeQueue('pausable');

      stats = await store.getStats('pausable');
      expect(stats[0].paused).toBe(false);
    });

    it('should clear a queue', async () => {
      await store.add('clear.job', { data: 1 }, { queue: 'clearable' });
      await store.add('clear.job', { data: 2 }, { queue: 'clearable' });

      let stats = await store.getStats('clearable');
      expect(stats[0].waiting).toBe(2);

      await store.clearQueue('clearable');

      stats = await store.getStats('clearable');
      expect(stats[0].waiting).toBe(0);
    });
  });

  // ==========================================================================
  // Job Processing
  // ==========================================================================

  describe('job processing', () => {
    it('should process jobs with worker', async () => {
      const processedJobs: unknown[] = [];

      // Register handler
      worker.registerHandler<{ value: number }>(
        'process.job',
        async (ctx) => {
          processedJobs.push(ctx.data);
        },
        { queue: 'processing', concurrency: 1 }
      );

      // Add jobs before starting worker
      await store.add('process.job', { value: 1 }, { queue: 'processing' });
      await store.add('process.job', { value: 2 }, { queue: 'processing' });

      // Start worker
      await worker.start();

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check jobs were processed
      expect(processedJobs).toHaveLength(2);
      expect(processedJobs).toContainEqual({ value: 1 });
      expect(processedJobs).toContainEqual({ value: 2 });

      // Check stats
      const stats = await store.getStats('processing');
      expect(stats[0].completed).toBe(2);
      expect(stats[0].waiting).toBe(0);
    }, 10000);

    it('should track job progress', async () => {
      const progressUpdates: number[] = [];

      worker.registerHandler<{ steps: number }>(
        'progress.job',
        async (ctx) => {
          for (let i = 1; i <= ctx.data.steps; i++) {
            await ctx.progress((i / ctx.data.steps) * 100);
            progressUpdates.push((i / ctx.data.steps) * 100);
          }
        },
        { queue: 'progress-queue', concurrency: 1 }
      );

      await store.add('progress.job', { steps: 4 }, { queue: 'progress-queue' });
      await worker.start();

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(progressUpdates).toEqual([25, 50, 75, 100]);
    }, 10000);
  });

  // ==========================================================================
  // Failed Jobs
  // ==========================================================================

  describe('failed jobs', () => {
    it('should handle failed jobs', async () => {
      worker.registerHandler(
        'failing.job',
        async () => {
          throw new Error('Intentional failure');
        },
        { queue: 'failing-queue', concurrency: 1 }
      );

      await store.add(
        'failing.job',
        { data: 'test' },
        {
          queue: 'failing-queue',
          jobOptions: { attempts: 1 }, // Only 1 attempt, no retries
        }
      );

      await worker.start();

      // Wait for job to fail
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const failedJobs = await store.getFailedJobs('failing-queue');
      expect(failedJobs).toHaveLength(1);
      expect(failedJobs[0].name).toBe('failing.job');
      expect(failedJobs[0].error).toContain('Intentional failure');
    }, 10000);

    it('should retry failed jobs', async () => {
      let attempts = 0;

      worker.registerHandler(
        'retry.job',
        async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Retry needed');
          }
        },
        { queue: 'retry-queue', concurrency: 1 }
      );

      await store.add(
        'retry.job',
        { data: 'test' },
        {
          queue: 'retry-queue',
          jobOptions: { attempts: 3, backoff: { type: 'fixed', delay: 100 } },
        }
      );

      await worker.start();

      // Wait for retries
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Should have succeeded on second attempt
      expect(attempts).toBe(2);

      const stats = await store.getStats('retry-queue');
      expect(stats[0].completed).toBe(1);
      expect(stats[0].failed).toBe(0);
    }, 10000);

    it('should remove a job', async () => {
      const jobId = await store.add('remove.job', { data: 'test' }, { queue: 'remove-queue' });

      let stats = await store.getStats('remove-queue');
      expect(stats[0].waiting).toBe(1);

      const removed = await store.removeJob(jobId, 'remove-queue');
      expect(removed).toBe(true);

      stats = await store.getStats('remove-queue');
      expect(stats[0].waiting).toBe(0);
    });
  });
});
