/**
 * Tests for Queue DI Providers
 *
 * Validates:
 * - registerQueueProviders bulk registration works correctly
 * - Services can be mocked/overridden in tests
 * - Queue manager is properly initialized
 * - Worker manager registration works when enabled
 */

import { Container } from '@veloxts/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineJob } from '../job.js';
import type { QueueManager, WorkerManager } from '../manager.js';
import { registerQueueProviders } from '../providers.js';
import { QUEUE_CONFIG, QUEUE_MANAGER, WORKER_MANAGER } from '../tokens.js';

// Test job for dispatch tests
const testJob = defineJob({
  name: 'test.job',
  schema: z.object({ message: z.string() }),
  handler: async ({ data }) => {
    // Simple handler for testing
    console.log(data.message);
  },
});

describe('Queue DI Providers', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  afterEach(async () => {
    // Clean up any queue managers created
    if (container.isRegistered(QUEUE_MANAGER)) {
      const queue = container.resolve(QUEUE_MANAGER);
      await queue.close();
    }
    if (container.isRegistered(WORKER_MANAGER)) {
      const worker = container.resolve(WORKER_MANAGER);
      await worker.close();
    }
  });

  describe('registerQueueProviders', () => {
    it('registers queue config and manager', async () => {
      await registerQueueProviders(container, { driver: 'sync' });

      expect(container.isRegistered(QUEUE_CONFIG)).toBe(true);
      expect(container.isRegistered(QUEUE_MANAGER)).toBe(true);
    });

    it('does not register worker manager by default', async () => {
      await registerQueueProviders(container, { driver: 'sync' });

      expect(container.isRegistered(WORKER_MANAGER)).toBe(false);
    });

    it('registers worker manager when includeWorker is true', async () => {
      await registerQueueProviders(container, {
        driver: 'sync',
        includeWorker: true,
      });

      expect(container.isRegistered(QUEUE_MANAGER)).toBe(true);
      expect(container.isRegistered(WORKER_MANAGER)).toBe(true);
    });

    it('config values are accessible from container', async () => {
      await registerQueueProviders(container, {
        driver: 'sync',
        defaultQueue: 'test-queue',
      });

      const config = container.resolve(QUEUE_CONFIG);

      expect(config.driver).toBe('sync');
      expect(config.defaultQueue).toBe('test-queue');
    });

    it('queue manager is fully functional after registration', async () => {
      await registerQueueProviders(container, { driver: 'sync' });

      const queue = container.resolve(QUEUE_MANAGER);

      // Dispatch should work
      const jobId = await queue.dispatch(testJob, { message: 'Hello' });
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });

    it('queue manager supports batch dispatch', async () => {
      await registerQueueProviders(container, { driver: 'sync' });

      const queue = container.resolve(QUEUE_MANAGER);

      const jobIds = await queue.dispatchBatch(testJob, [
        { message: 'Hello 1' },
        { message: 'Hello 2' },
        { message: 'Hello 3' },
      ]);

      expect(jobIds).toHaveLength(3);
      expect(jobIds.every((id) => typeof id === 'string')).toBe(true);
    });

    it('queue manager supports getStats', async () => {
      await registerQueueProviders(container, { driver: 'sync' });

      const queue = container.resolve(QUEUE_MANAGER);

      const stats = await queue.getStats();
      expect(Array.isArray(stats)).toBe(true);
    });

    it('worker manager is functional when registered', async () => {
      await registerQueueProviders(container, {
        driver: 'sync',
        includeWorker: true,
      });

      const worker = container.resolve(WORKER_MANAGER);

      // Register a job
      worker.register(testJob);

      // Start should not throw
      await expect(worker.start()).resolves.toBeUndefined();

      // Stop should not throw
      await expect(worker.stop()).resolves.toBeUndefined();
    });

    it('worker manager supports registerAll', async () => {
      const anotherJob = defineJob({
        name: 'another.job',
        schema: z.object({ value: z.number() }),
        handler: async () => {},
      });

      await registerQueueProviders(container, {
        driver: 'sync',
        includeWorker: true,
      });

      const worker = container.resolve(WORKER_MANAGER);

      // Should not throw
      worker.registerAll([testJob, anotherJob]);
    });
  });

  describe('Service Mocking', () => {
    it('allows mocking QUEUE_MANAGER after registration', async () => {
      await registerQueueProviders(container, { driver: 'sync' });

      // Create a mock queue manager
      const mockQueueManager: Partial<QueueManager> = {
        dispatch: vi.fn().mockResolvedValue('mock-job-id'),
        close: vi.fn().mockResolvedValue(undefined),
      };

      container.register({ provide: QUEUE_MANAGER, useValue: mockQueueManager });

      const queue = container.resolve(QUEUE_MANAGER);

      expect(queue).toBe(mockQueueManager);
      expect(await queue.dispatch(testJob, { message: 'test' })).toBe('mock-job-id');
    });

    it('allows mocking WORKER_MANAGER after registration', async () => {
      await registerQueueProviders(container, {
        driver: 'sync',
        includeWorker: true,
      });

      const mockWorkerManager: Partial<WorkerManager> = {
        register: vi.fn(),
        start: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      container.register({ provide: WORKER_MANAGER, useValue: mockWorkerManager });

      const worker = container.resolve(WORKER_MANAGER);

      expect(worker).toBe(mockWorkerManager);
    });

    it('allows mocking QUEUE_CONFIG after registration', async () => {
      await registerQueueProviders(container, { driver: 'sync' });

      const mockConfig = { driver: 'bullmq' as const, defaultQueue: 'mocked' };
      container.register({ provide: QUEUE_CONFIG, useValue: mockConfig });

      const config = container.resolve(QUEUE_CONFIG);

      expect(config).toBe(mockConfig);
      expect(config.driver).toBe('bullmq');
    });

    it('child container can override parent registrations', async () => {
      await registerQueueProviders(container, { driver: 'sync' });

      const childContainer = container.createChild();

      const mockQueueManager: Partial<QueueManager> = {
        dispatch: vi.fn().mockResolvedValue('child-job-id'),
        close: vi.fn().mockResolvedValue(undefined),
      };

      childContainer.register({ provide: QUEUE_MANAGER, useValue: mockQueueManager });

      const parentQueue = container.resolve(QUEUE_MANAGER);
      const childQueue = childContainer.resolve(QUEUE_MANAGER);

      expect(childQueue).toBe(mockQueueManager);
      expect(parentQueue).not.toBe(mockQueueManager);
    });

    it('child container inherits parent registrations', async () => {
      await registerQueueProviders(container, { driver: 'sync' });

      const childContainer = container.createChild();

      // Should resolve from parent
      const queue = childContainer.resolve(QUEUE_MANAGER);
      const config = childContainer.resolve(QUEUE_CONFIG);

      expect(queue).toBeDefined();
      expect(config).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('throws when resolving unregistered QUEUE_MANAGER token', () => {
      expect(() => container.resolve(QUEUE_MANAGER)).toThrow(
        'No provider found for: QUEUE_MANAGER'
      );
    });

    it('throws when resolving unregistered WORKER_MANAGER token', () => {
      expect(() => container.resolve(WORKER_MANAGER)).toThrow(
        'No provider found for: WORKER_MANAGER'
      );
    });

    it('throws when resolving QUEUE_CONFIG without registration', () => {
      expect(() => container.resolve(QUEUE_CONFIG)).toThrow('No provider found for: QUEUE_CONFIG');
    });
  });

  describe('Integration with Real Services', () => {
    it('complete queue flow works with DI-provided services', async () => {
      await registerQueueProviders(container, {
        driver: 'sync',
        defaultQueue: 'integration',
        includeWorker: true,
      });

      const queue = container.resolve(QUEUE_MANAGER);
      const worker = container.resolve(WORKER_MANAGER);
      const config = container.resolve(QUEUE_CONFIG);

      // Config should be accessible
      expect(config.driver).toBe('sync');
      expect(config.defaultQueue).toBe('integration');

      // Register job handler
      worker.register(testJob);

      // Start worker
      await worker.start();

      // Dispatch job (sync driver processes immediately)
      const jobId = await queue.dispatch(testJob, { message: 'Integration test' });
      expect(jobId).toBeDefined();

      // Stop worker
      await worker.stop();
    });

    it('multiple containers can have independent queue instances', async () => {
      const container1 = new Container();
      const container2 = new Container();

      await registerQueueProviders(container1, {
        driver: 'sync',
        defaultQueue: 'queue1',
      });

      await registerQueueProviders(container2, {
        driver: 'sync',
        defaultQueue: 'queue2',
      });

      const queue1 = container1.resolve(QUEUE_MANAGER);
      const queue2 = container2.resolve(QUEUE_MANAGER);

      // Different instances
      expect(queue1).not.toBe(queue2);

      // Different configs
      const config1 = container1.resolve(QUEUE_CONFIG);
      const config2 = container2.resolve(QUEUE_CONFIG);
      expect(config1.defaultQueue).toBe('queue1');
      expect(config2.defaultQueue).toBe('queue2');

      // Cleanup
      await queue1.close();
      await queue2.close();
    });

    it('queue validates job data against schema', async () => {
      await registerQueueProviders(container, { driver: 'sync' });

      const queue = container.resolve(QUEUE_MANAGER);

      // Valid data should work
      await expect(queue.dispatch(testJob, { message: 'valid' })).resolves.toBeDefined();

      // Invalid data should throw
      await expect(
        queue.dispatch(testJob, { message: 123 } as unknown as { message: string })
      ).rejects.toThrow();
    });
  });
});
