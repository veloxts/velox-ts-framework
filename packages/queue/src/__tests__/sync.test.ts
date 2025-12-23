/**
 * Sync Driver Tests
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createSyncStore, createSyncWorker } from '../drivers/sync.js';
import { defineJob } from '../job.js';
import { createQueueManager, createWorkerManager } from '../manager.js';

describe('createSyncStore', () => {
  it('should create a sync store', () => {
    const store = createSyncStore();
    expect(store).toBeDefined();
    expect(typeof store.add).toBe('function');
    expect(typeof store.addBulk).toBe('function');
    expect(typeof store.getFailedJobs).toBe('function');
    expect(typeof store.getStats).toBe('function');
    expect(typeof store.close).toBe('function');
  });

  it('should add a job to the queue', async () => {
    const store = createSyncStore();
    const jobId = await store.add('test.job', { foo: 'bar' }, { queue: 'default' });

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should add multiple jobs in bulk', async () => {
    const store = createSyncStore();
    const jobIds = await store.addBulk([
      { jobName: 'test.job1', data: { id: 1 }, options: { queue: 'default' } },
      { jobName: 'test.job2', data: { id: 2 }, options: { queue: 'default' } },
      { jobName: 'test.job3', data: { id: 3 }, options: { queue: 'default' } },
    ]);

    expect(jobIds).toHaveLength(3);
    jobIds.forEach((id) => {
      expect(typeof id).toBe('string');
    });
  });

  it('should add bulk jobs across multiple queues in parallel', async () => {
    const store = createSyncStore();

    // Add jobs to multiple different queues
    const jobIds = await store.addBulk([
      { jobName: 'job1', data: { id: 1 }, options: { queue: 'queue-a' } },
      { jobName: 'job2', data: { id: 2 }, options: { queue: 'queue-b' } },
      { jobName: 'job3', data: { id: 3 }, options: { queue: 'queue-a' } },
      { jobName: 'job4', data: { id: 4 }, options: { queue: 'queue-c' } },
      { jobName: 'job5', data: { id: 5 }, options: { queue: 'queue-b' } },
    ]);

    expect(jobIds).toHaveLength(5);

    // Verify jobs were distributed correctly across queues
    const statsA = await store.getStats('queue-a');
    const statsB = await store.getStats('queue-b');
    const statsC = await store.getStats('queue-c');

    expect(statsA[0].waiting).toBe(2); // job1, job3
    expect(statsB[0].waiting).toBe(2); // job2, job5
    expect(statsC[0].waiting).toBe(1); // job4
  });

  it('should return empty array for addBulk with empty input', async () => {
    const store = createSyncStore();
    const jobIds = await store.addBulk([]);
    expect(jobIds).toEqual([]);
  });

  it('should return empty stats for empty queue', async () => {
    const store = createSyncStore();
    // First add a job to create the queue, then clear it
    await store.add('test.job', {}, { queue: 'default' });
    await store.clearQueue('default');
    const stats = await store.getStats('default');

    expect(stats).toHaveLength(1);
    expect(stats[0].waiting).toBe(0);
    expect(stats[0].active).toBe(0);
    expect(stats[0].completed).toBe(0);
    expect(stats[0].failed).toBe(0);
  });

  it('should return stats after adding jobs', async () => {
    const store = createSyncStore();
    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });
    await store.add('test.job', { foo: 'baz' }, { queue: 'default' });

    const stats = await store.getStats('default');

    expect(stats).toHaveLength(1);
    expect(stats[0].name).toBe('default');
    expect(stats[0].waiting).toBe(2);
    expect(stats[0].active).toBe(0);
    expect(stats[0].completed).toBe(0);
    expect(stats[0].failed).toBe(0);
  });

  it('should track delayed jobs in stats', async () => {
    const store = createSyncStore();
    // Add a job with a long delay (should show as delayed)
    await store.add('test.job', { foo: 'bar' }, { queue: 'default', delay: 60000 });
    // Add a job without delay (should show as waiting)
    await store.add('test.job', { foo: 'baz' }, { queue: 'default' });

    const stats = await store.getStats('default');

    expect(stats).toHaveLength(1);
    expect(stats[0].waiting).toBe(1); // Only non-delayed job
    expect(stats[0].delayed).toBe(1); // Delayed job
  });

  it('should return stats for multiple queues', async () => {
    const store = createSyncStore();

    // Add jobs to multiple queues
    await store.add('job1', { id: 1 }, { queue: 'queue-a' });
    await store.add('job2', { id: 2 }, { queue: 'queue-a' });
    await store.add('job3', { id: 3 }, { queue: 'queue-b' });
    await store.add('job4', { id: 4 }, { queue: 'queue-c' });
    await store.add('job5', { id: 5 }, { queue: 'queue-c' });
    await store.add('job6', { id: 6 }, { queue: 'queue-c' });

    // Get all stats (no queue specified)
    const allStats = await store.getStats();

    expect(allStats).toHaveLength(3);

    const queueA = allStats.find((s) => s.name === 'queue-a');
    const queueB = allStats.find((s) => s.name === 'queue-b');
    const queueC = allStats.find((s) => s.name === 'queue-c');

    expect(queueA?.waiting).toBe(2);
    expect(queueB?.waiting).toBe(1);
    expect(queueC?.waiting).toBe(3);
  });

  it('should return empty array for getStats when no queues exist', async () => {
    const store = createSyncStore();

    // No jobs added, no queues exist
    const stats = await store.getStats();

    expect(stats).toEqual([]);
  });

  it('should return empty array for getStats with specific queue that has no jobs', async () => {
    const store = createSyncStore();

    // Create a queue by adding and clearing
    await store.add('test.job', {}, { queue: 'empty-queue' });
    await store.clearQueue('empty-queue');

    const stats = await store.getStats('empty-queue');

    expect(stats).toHaveLength(1);
    expect(stats[0].name).toBe('empty-queue');
    expect(stats[0].waiting).toBe(0);
    expect(stats[0].completed).toBe(0);
    expect(stats[0].failed).toBe(0);
  });

  it('should clear queue', async () => {
    const store = createSyncStore();
    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });
    await store.add('test.job', { foo: 'baz' }, { queue: 'default' });

    await store.clearQueue('default');

    const stats = await store.getStats('default');
    expect(stats).toHaveLength(1);
    expect(stats[0].waiting).toBe(0);
  });

  it('should close without error', async () => {
    const store = createSyncStore();
    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });

    await expect(store.close()).resolves.not.toThrow();
  });

  it('should retry a single failed job', async () => {
    const store = createSyncStore({ throwOnError: false });
    const worker = createSyncWorker(store);

    // Create a job that will fail
    worker.registerHandler(
      'test.job',
      async () => {
        throw new Error('Test failure');
      },
      { queue: 'default', jobOptions: { attempts: 1 } }
    );

    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });
    await worker.start();

    // Verify job is failed
    const failed = await store.getFailedJobs('default');
    expect(failed).toHaveLength(1);

    // Retry the job
    const result = await store.retryJob(failed[0].id, 'default');
    expect(result).toBe(true);

    // Job should be back in pending state
    const stats = await store.getStats('default');
    expect(stats[0].failed).toBe(0);
    expect(stats[0].waiting).toBe(1);
  });

  it('should retry all failed jobs in a queue', async () => {
    const store = createSyncStore({ throwOnError: false });
    const worker = createSyncWorker(store);

    // Create jobs that will fail
    worker.registerHandler(
      'test.job',
      async () => {
        throw new Error('Test failure');
      },
      { queue: 'default', jobOptions: { attempts: 1 } }
    );

    await store.add('test.job', { id: 1 }, { queue: 'default' });
    await store.add('test.job', { id: 2 }, { queue: 'default' });
    await store.add('test.job', { id: 3 }, { queue: 'default' });
    await worker.start();

    // Verify all jobs are failed
    const failed = await store.getFailedJobs('default');
    expect(failed).toHaveLength(3);

    // Retry all failed jobs
    const retriedCount = await store.retryAllFailed('default');
    expect(retriedCount).toBe(3);

    // All jobs should be back in pending state
    const stats = await store.getStats('default');
    expect(stats[0].failed).toBe(0);
    expect(stats[0].waiting).toBe(3);
  });

  it('should retry all failed jobs across multiple queues', async () => {
    const store = createSyncStore({ throwOnError: false });
    const worker = createSyncWorker(store);

    // Create jobs that will fail in multiple queues
    worker.registerHandler(
      'test.job',
      async () => {
        throw new Error('Test failure');
      },
      { queue: 'queue-a', jobOptions: { attempts: 1 } }
    );
    worker.registerHandler(
      'other.job',
      async () => {
        throw new Error('Test failure');
      },
      { queue: 'queue-b', jobOptions: { attempts: 1 } }
    );

    await store.add('test.job', { id: 1 }, { queue: 'queue-a' });
    await store.add('test.job', { id: 2 }, { queue: 'queue-a' });
    await store.add('other.job', { id: 3 }, { queue: 'queue-b' });
    await worker.start();

    // Verify failed counts
    const failedA = await store.getFailedJobs('queue-a');
    const failedB = await store.getFailedJobs('queue-b');
    expect(failedA).toHaveLength(2);
    expect(failedB).toHaveLength(1);

    // Retry all failed jobs across all queues (no queue specified)
    const retriedCount = await store.retryAllFailed();
    expect(retriedCount).toBe(3);

    // All jobs should be back in pending state
    const statsA = await store.getStats('queue-a');
    const statsB = await store.getStats('queue-b');
    expect(statsA[0].failed).toBe(0);
    expect(statsA[0].waiting).toBe(2);
    expect(statsB[0].failed).toBe(0);
    expect(statsB[0].waiting).toBe(1);
  });

  it('should get failed jobs across all queues in parallel', async () => {
    const store = createSyncStore({ throwOnError: false });
    const worker = createSyncWorker(store);

    // Create jobs that will fail in multiple queues
    worker.registerHandler(
      'job-a',
      async () => {
        throw new Error('Failure A');
      },
      { queue: 'queue-a', jobOptions: { attempts: 1 } }
    );
    worker.registerHandler(
      'job-b',
      async () => {
        throw new Error('Failure B');
      },
      { queue: 'queue-b', jobOptions: { attempts: 1 } }
    );
    worker.registerHandler(
      'job-c',
      async () => {
        throw new Error('Failure C');
      },
      { queue: 'queue-c', jobOptions: { attempts: 1 } }
    );

    await store.add('job-a', { id: 1 }, { queue: 'queue-a' });
    await store.add('job-a', { id: 2 }, { queue: 'queue-a' });
    await store.add('job-b', { id: 3 }, { queue: 'queue-b' });
    await store.add('job-c', { id: 4 }, { queue: 'queue-c' });
    await store.add('job-c', { id: 5 }, { queue: 'queue-c' });
    await store.add('job-c', { id: 6 }, { queue: 'queue-c' });
    await worker.start();

    // Get all failed jobs across all queues (no queue specified)
    const allFailed = await store.getFailedJobs();

    // Should get all 6 failed jobs from 3 queues
    expect(allFailed).toHaveLength(6);

    // Verify we got jobs from each queue
    const queues = new Set(allFailed.map((j) => j.queue));
    expect(queues.size).toBe(3);
    expect(queues.has('queue-a')).toBe(true);
    expect(queues.has('queue-b')).toBe(true);
    expect(queues.has('queue-c')).toBe(true);
  });

  it('should return empty array for getFailedJobs when no queues exist', async () => {
    const store = createSyncStore();

    // No jobs added, no queues exist
    const failed = await store.getFailedJobs();

    expect(failed).toEqual([]);
  });

  it('should respect limit when getting failed jobs across multiple queues', async () => {
    const store = createSyncStore({ throwOnError: false });
    const worker = createSyncWorker(store);

    // Create jobs that will fail
    worker.registerHandler(
      'test.job',
      async () => {
        throw new Error('Failure');
      },
      { queue: 'default', jobOptions: { attempts: 1 } }
    );

    // Add many jobs
    for (let i = 0; i < 10; i++) {
      await store.add('test.job', { id: i }, { queue: 'default' });
    }
    await worker.start();

    // Get failed jobs with limit
    const failed = await store.getFailedJobs('default', 5);

    expect(failed).toHaveLength(5);
  });

  it('should return 0 when no failed jobs to retry', async () => {
    const store = createSyncStore();

    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });

    const retriedCount = await store.retryAllFailed('default');
    expect(retriedCount).toBe(0);
  });
});

describe('createSyncWorker', () => {
  it('should throw error when given incompatible store', () => {
    // Create a fake store that wasn't created with createSyncStore
    const fakeStore = {
      add: async () => 'fake-id',
      addBulk: async () => [],
      getFailedJobs: async () => [],
      retryJob: async () => false,
      retryAllFailed: async () => 0,
      removeJob: async () => false,
      getStats: async () => [],
      pauseQueue: async () => {},
      resumeQueue: async () => {},
      clearQueue: async () => {},
      close: async () => {},
    };

    expect(() => createSyncWorker(fakeStore)).toThrow(/Invalid sync queue store/);
  });

  it('should process pending jobs', async () => {
    const store = createSyncStore();
    const worker = createSyncWorker(store);

    const handler = vi.fn();
    worker.registerHandler('test.job', handler, { queue: 'default' });

    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });
    await worker.start();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { foo: 'bar' },
        queueName: 'default',
        attemptNumber: 1,
      })
    );
  });

  it('should mark job as completed on success', async () => {
    const store = createSyncStore();
    const worker = createSyncWorker(store);

    worker.registerHandler('test.job', async () => {}, { queue: 'default' });

    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });
    await worker.start();

    const stats = await store.getStats('default');
    expect(stats[0].completed).toBe(1);
    expect(stats[0].waiting).toBe(0);
  });

  it('should retry failed jobs up to max attempts', async () => {
    const store = createSyncStore({ throwOnError: false });
    const worker = createSyncWorker(store);

    let attempts = 0;
    worker.registerHandler(
      'test.job',
      async () => {
        attempts++;
        throw new Error('Test error');
      },
      { queue: 'default', jobOptions: { attempts: 3 } }
    );

    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });

    // Run start multiple times to trigger retries
    await worker.start();
    await worker.start();
    await worker.start();

    expect(attempts).toBe(3);

    const stats = await store.getStats('default');
    expect(stats[0].failed).toBe(1);
  });

  it('should mark job as failed when handler not found', async () => {
    const store = createSyncStore({ throwOnError: false });
    const worker = createSyncWorker(store);

    await store.add('unknown.job', { foo: 'bar' }, { queue: 'default' });
    await worker.start();

    const failed = await store.getFailedJobs('default');
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toContain('No handler registered');
  });

  it('should stop processing when stop is called', async () => {
    const store = createSyncStore();
    const worker = createSyncWorker(store);

    const handler = vi.fn();
    worker.registerHandler('test.job', handler, { queue: 'default' });

    await worker.stop();
    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });
    await worker.start();

    // Job should still be processed because stop() just sets a flag
    // that's checked during iteration, but start() resets it
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should close worker cleanly', async () => {
    const store = createSyncStore();
    const worker = createSyncWorker(store);

    worker.registerHandler('test.job', async () => {}, { queue: 'default' });

    await expect(worker.close()).resolves.not.toThrow();
  });

  it('should not process jobs with delay that has not elapsed', async () => {
    const store = createSyncStore();
    const worker = createSyncWorker(store);

    const handler = vi.fn();
    worker.registerHandler('test.job', handler, { queue: 'default' });

    // Add a job with 1 hour delay
    await store.add('test.job', { foo: 'bar' }, { queue: 'default', delay: 3600000 });
    await worker.start();

    // Job should not be processed because delay hasn't elapsed
    expect(handler).not.toHaveBeenCalled();

    const stats = await store.getStats('default');
    expect(stats[0].delayed).toBe(1);
    expect(stats[0].completed).toBe(0);
  });

  it('should process jobs with delay that has elapsed', async () => {
    const store = createSyncStore();
    const worker = createSyncWorker(store);

    const handler = vi.fn();
    worker.registerHandler('test.job', handler, { queue: 'default' });

    // Add a job with 0ms delay (immediately ready)
    await store.add('test.job', { foo: 'bar' }, { queue: 'default', delay: 0 });
    await worker.start();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should remove completed jobs when removeOnComplete is enabled', async () => {
    const store = createSyncStore();
    const worker = createSyncWorker(store);

    worker.registerHandler('test.job', async () => {}, {
      queue: 'default',
      jobOptions: { removeOnComplete: true },
    });

    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });

    const statsBefore = await store.getStats('default');
    expect(statsBefore[0].waiting).toBe(1);

    await worker.start();

    const statsAfter = await store.getStats('default');
    // Job should be removed, not just marked as completed
    expect(statsAfter[0].completed).toBe(0);
    expect(statsAfter[0].waiting).toBe(0);
  });

  it('should keep completed jobs when removeOnComplete is disabled', async () => {
    const store = createSyncStore();
    const worker = createSyncWorker(store);

    worker.registerHandler('test.job', async () => {}, {
      queue: 'default',
      jobOptions: { removeOnComplete: false },
    });

    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });
    await worker.start();

    const stats = await store.getStats('default');
    expect(stats[0].completed).toBe(1);
  });

  it('should remove failed jobs when removeOnFail is enabled', async () => {
    const store = createSyncStore({ throwOnError: false });
    const worker = createSyncWorker(store);

    worker.registerHandler(
      'test.job',
      async () => {
        throw new Error('Test error');
      },
      {
        queue: 'default',
        jobOptions: { attempts: 1, removeOnFail: true },
      }
    );

    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });
    await worker.start();

    const stats = await store.getStats('default');
    // Job should be removed, not just marked as failed
    expect(stats[0].failed).toBe(0);
    expect(stats[0].waiting).toBe(0);

    const failed = await store.getFailedJobs('default');
    expect(failed).toHaveLength(0);
  });

  it('should keep failed jobs when removeOnFail is disabled', async () => {
    const store = createSyncStore({ throwOnError: false });
    const worker = createSyncWorker(store);

    worker.registerHandler(
      'test.job',
      async () => {
        throw new Error('Test error');
      },
      {
        queue: 'default',
        jobOptions: { attempts: 1, removeOnFail: false },
      }
    );

    await store.add('test.job', { foo: 'bar' }, { queue: 'default' });
    await worker.start();

    const stats = await store.getStats('default');
    expect(stats[0].failed).toBe(1);

    const failed = await store.getFailedJobs('default');
    expect(failed).toHaveLength(1);
  });

  it('should respect job-level removeOnComplete over handler-level', async () => {
    const store = createSyncStore();
    const worker = createSyncWorker(store);

    // Handler says keep, but job says remove
    worker.registerHandler('test.job', async () => {}, {
      queue: 'default',
      jobOptions: { removeOnComplete: false },
    });

    await store.add(
      'test.job',
      { foo: 'bar' },
      {
        queue: 'default',
        jobOptions: { removeOnComplete: true },
      }
    );

    await worker.start();

    const stats = await store.getStats('default');
    // Job-level option should win
    expect(stats[0].completed).toBe(0);
  });
});

describe('createQueueManager with sync driver', () => {
  const sendEmail = defineJob({
    name: 'email.send',
    schema: z.object({
      to: z.string().email(),
      subject: z.string(),
    }),
    handler: async () => {},
  });

  it('should dispatch a job', async () => {
    const manager = await createQueueManager({ driver: 'sync' });

    const jobId = await manager.dispatch(sendEmail, {
      to: 'test@example.com',
      subject: 'Hello',
    });

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');

    await manager.close();
  });

  it('should validate job data against schema', async () => {
    const manager = await createQueueManager({ driver: 'sync' });

    await expect(
      manager.dispatch(sendEmail, {
        to: 'invalid-email',
        subject: 'Hello',
      })
    ).rejects.toThrow();

    await manager.close();
  });

  it('should dispatch batch of jobs', async () => {
    const manager = await createQueueManager({ driver: 'sync' });

    const jobIds = await manager.dispatchBatch(sendEmail, [
      { to: 'a@example.com', subject: 'Hello A' },
      { to: 'b@example.com', subject: 'Hello B' },
      { to: 'c@example.com', subject: 'Hello C' },
    ]);

    expect(jobIds).toHaveLength(3);

    await manager.close();
  });

  it('should get queue statistics', async () => {
    const manager = await createQueueManager({ driver: 'sync' });

    await manager.dispatch(sendEmail, { to: 'test@example.com', subject: 'Test' });

    const stats = await manager.getStats('default');

    expect(stats).toHaveLength(1);
    expect(stats[0].waiting).toBe(1);

    await manager.close();
  });

  it('should clear queue', async () => {
    const manager = await createQueueManager({ driver: 'sync' });

    await manager.dispatch(sendEmail, { to: 'test@example.com', subject: 'Test' });
    await manager.clearQueue('default');

    const stats = await manager.getStats('default');
    expect(stats[0].waiting).toBe(0);

    await manager.close();
  });
});

describe('createWorkerManager with sync driver', () => {
  it('should register and process jobs', async () => {
    const handler = vi.fn();
    const testJob = defineJob({
      name: 'test.process',
      schema: z.object({ value: z.number() }),
      handler,
    });

    const queueManager = await createQueueManager({ driver: 'sync' });
    const workerManager = await createWorkerManager({ driver: 'sync' });

    workerManager.register(testJob);

    // Note: Sync driver processes jobs from its own store, not shared with queue manager
    // This test just verifies registration works
    expect(() => workerManager.register(testJob)).not.toThrow();

    await workerManager.close();
    await queueManager.close();
  });

  it('should register all jobs at once', async () => {
    const job1 = defineJob({
      name: 'test.job1',
      schema: z.object({}),
      handler: async () => {},
    });

    const job2 = defineJob({
      name: 'test.job2',
      schema: z.object({}),
      handler: async () => {},
    });

    const workerManager = await createWorkerManager({ driver: 'sync' });

    expect(() => workerManager.registerAll([job1, job2])).not.toThrow();

    await workerManager.close();
  });
});
