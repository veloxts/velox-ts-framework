/**
 * Queue Manager
 *
 * High-level queue API for dispatching and managing jobs.
 */

import type { z } from 'zod';

import { createBullMQStore, createBullMQWorker } from './drivers/bullmq.js';
import { createSyncStore, createSyncWorker } from './drivers/sync.js';
import type { JobDefinition } from './job.js';
import type {
  DispatchOptions,
  FailedJob,
  JobHandler,
  QueuePluginOptions,
  QueueStats,
  QueueStore,
  WorkerStore,
} from './types.js';
import { parseDelay } from './utils.js';

/**
 * Queue manager interface.
 */
export interface QueueManager {
  /**
   * Dispatch a job to the queue.
   */
  dispatch<TSchema extends z.ZodType>(
    job: JobDefinition<TSchema>,
    data: z.infer<TSchema>,
    options?: DispatchOptions
  ): Promise<string>;

  /**
   * Dispatch multiple jobs to the queue.
   */
  dispatchBatch<TSchema extends z.ZodType>(
    job: JobDefinition<TSchema>,
    dataItems: z.infer<TSchema>[],
    options?: DispatchOptions
  ): Promise<string[]>;

  /**
   * Get failed jobs.
   */
  getFailedJobs(queue?: string, limit?: number): Promise<FailedJob[]>;

  /**
   * Retry a failed job.
   */
  retryJob(jobId: string, queue: string): Promise<boolean>;

  /**
   * Retry all failed jobs.
   */
  retryAllFailed(queue?: string): Promise<number>;

  /**
   * Remove a job from the queue.
   */
  removeJob(jobId: string, queue: string): Promise<boolean>;

  /**
   * Get queue statistics.
   */
  getStats(queue?: string): Promise<QueueStats[]>;

  /**
   * Pause a queue.
   */
  pauseQueue(queue: string): Promise<void>;

  /**
   * Resume a queue.
   */
  resumeQueue(queue: string): Promise<void>;

  /**
   * Clear all jobs from a queue.
   */
  clearQueue(queue: string): Promise<void>;

  /**
   * Close connections.
   */
  close(): Promise<void>;
}

/**
 * Worker manager interface for processing jobs.
 */
export interface WorkerManager {
  /**
   * Register a job handler.
   */
  register<TSchema extends z.ZodType>(job: JobDefinition<TSchema>): void;

  /**
   * Register multiple job handlers.
   */
  registerAll(jobs: JobDefinition<z.ZodType>[]): void;

  /**
   * Start processing jobs.
   */
  start(): Promise<void>;

  /**
   * Stop processing jobs gracefully.
   */
  stop(): Promise<void>;

  /**
   * Close connections.
   */
  close(): Promise<void>;
}

/**
 * Create a queue manager.
 *
 * @param options - Queue plugin options
 * @returns Queue manager instance
 *
 * @example
 * ```typescript
 * // BullMQ (production)
 * const queue = await createQueueManager({
 *   driver: 'bullmq',
 *   config: { url: process.env.REDIS_URL },
 * });
 *
 * // Dispatch a job
 * await queue.dispatch(sendWelcomeEmail, { userId: '123', email: 'user@example.com' });
 *
 * // Dispatch with delay
 * await queue.dispatch(sendReminder, { userId: '123' }, { delay: '10m' });
 *
 * // Batch dispatch
 * await queue.dispatchBatch(processOrder, [
 *   { orderId: '1' },
 *   { orderId: '2' },
 *   { orderId: '3' },
 * ]);
 * ```
 */
export async function createQueueManager(options: QueuePluginOptions = {}): Promise<QueueManager> {
  const defaultQueue = options.defaultQueue ?? 'default';

  let store: QueueStore;

  // Create the appropriate driver with type-safe config narrowing
  if (options.driver === 'sync') {
    // Type narrows: options.config is SyncConfig | undefined
    store = createSyncStore(options.config);
  } else {
    // Type narrows: options.config is BullMQConfig | undefined (driver is 'bullmq' or undefined)
    store = await createBullMQStore(options.config);
  }

  const manager: QueueManager = {
    async dispatch<TSchema extends z.ZodType>(
      job: JobDefinition<TSchema>,
      data: z.infer<TSchema>,
      dispatchOptions?: DispatchOptions
    ): Promise<string> {
      // Validate data against schema
      const validatedData = job.schema.parse(data);

      const queueName = dispatchOptions?.queue ?? job.queue ?? defaultQueue;
      const delay = dispatchOptions?.delay ? parseDelay(dispatchOptions.delay) : undefined;
      const jobOptions = { ...job.options, ...dispatchOptions?.jobOptions };

      return store.add(job.name, validatedData, {
        queue: queueName,
        delay,
        jobOptions,
      });
    },

    async dispatchBatch<TSchema extends z.ZodType>(
      job: JobDefinition<TSchema>,
      dataItems: z.infer<TSchema>[],
      dispatchOptions?: DispatchOptions
    ): Promise<string[]> {
      const queueName = dispatchOptions?.queue ?? job.queue ?? defaultQueue;
      const delay = dispatchOptions?.delay ? parseDelay(dispatchOptions.delay) : undefined;
      const jobOptions = { ...job.options, ...dispatchOptions?.jobOptions };

      // Validate all data items
      const validatedItems = dataItems.map((item) => job.schema.parse(item));

      return store.addBulk(
        validatedItems.map((data) => ({
          jobName: job.name,
          data,
          options: {
            queue: queueName,
            delay,
            jobOptions,
          },
        }))
      );
    },

    async getFailedJobs(queue?: string, limit?: number): Promise<FailedJob[]> {
      return store.getFailedJobs(queue, limit);
    },

    async retryJob(jobId: string, queue: string): Promise<boolean> {
      return store.retryJob(jobId, queue);
    },

    async retryAllFailed(queue?: string): Promise<number> {
      return store.retryAllFailed(queue);
    },

    async removeJob(jobId: string, queue: string): Promise<boolean> {
      return store.removeJob(jobId, queue);
    },

    async getStats(queue?: string): Promise<QueueStats[]> {
      return store.getStats(queue);
    },

    async pauseQueue(queue: string): Promise<void> {
      await store.pauseQueue(queue);
    },

    async resumeQueue(queue: string): Promise<void> {
      await store.resumeQueue(queue);
    },

    async clearQueue(queue: string): Promise<void> {
      await store.clearQueue(queue);
    },

    async close(): Promise<void> {
      await store.close();
    },
  };

  return manager;
}

/**
 * Create a worker manager for processing jobs.
 *
 * @param options - Queue plugin options
 * @returns Worker manager instance
 *
 * @example
 * ```typescript
 * const worker = await createWorkerManager({
 *   driver: 'bullmq',
 *   config: { url: process.env.REDIS_URL },
 * });
 *
 * // Register jobs
 * worker.register(sendWelcomeEmail);
 * worker.register(processOrder);
 *
 * // Or register all at once
 * worker.registerAll([sendWelcomeEmail, processOrder]);
 *
 * // Start processing
 * await worker.start();
 *
 * // Graceful shutdown
 * process.on('SIGTERM', async () => {
 *   await worker.stop();
 *   await worker.close();
 *   process.exit(0);
 * });
 * ```
 */
export async function createWorkerManager(
  options: QueuePluginOptions = {}
): Promise<WorkerManager> {
  const defaultQueue = options.defaultQueue ?? 'default';

  let store: WorkerStore;
  let syncStore: QueueStore | null = null;

  // Create the appropriate driver with type-safe config narrowing
  if (options.driver === 'sync') {
    // Type narrows: options.config is SyncConfig | undefined
    // Create sync store and worker - they share internal state via WeakMap
    const ss = createSyncStore(options.config);
    syncStore = ss;
    store = createSyncWorker(ss);
  } else {
    // Type narrows: options.config is BullMQConfig | undefined (driver is 'bullmq' or undefined)
    store = await createBullMQWorker(options.config);
  }

  const worker: WorkerManager = {
    register<TSchema extends z.ZodType>(job: JobDefinition<TSchema>): void {
      const wrappedHandler: JobHandler<z.infer<TSchema>> = async (context) => {
        // Validate data on processing (belt and suspenders)
        const validatedData = job.schema.parse(context.data);
        await job.handler({ ...context, data: validatedData });
      };

      store.registerHandler(job.name, wrappedHandler, {
        queue: job.queue ?? defaultQueue,
        jobOptions: job.options,
      });
    },

    registerAll(jobs: JobDefinition<z.ZodType>[]): void {
      for (const job of jobs) {
        worker.register(job);
      }
    },

    async start(): Promise<void> {
      await store.start();
    },

    async stop(): Promise<void> {
      await store.stop();
    },

    async close(): Promise<void> {
      await store.close();
      if (syncStore) {
        await syncStore.close();
      }
    },
  };

  return worker;
}

/**
 * Alias for createQueueManager.
 */
export const queue = createQueueManager;
