/**
 * Sync Queue Driver
 *
 * Synchronous queue driver for development and testing.
 * Jobs are processed immediately without Redis.
 */

import type {
  FailedJob,
  JobContext,
  JobHandler,
  JobOptions,
  QueueStats,
  QueueStore,
  SyncConfig,
  WorkerStore,
} from '../types.js';
import { generateJobId } from '../utils.js';

/**
 * Default configuration for sync driver.
 */
const DEFAULT_CONFIG: Required<SyncConfig> = {
  throwOnError: true,
};

/**
 * In-memory job storage for sync driver.
 */
export interface StoredJob {
  id: string;
  name: string;
  queue: string;
  data: unknown;
  delay?: number;
  jobOptions?: JobOptions;
  status: 'pending' | 'active' | 'completed' | 'failed';
  error?: string;
  stackTrace?: string;
  attemptsMade: number;
  createdAt: Date;
  failedAt?: Date;
}

/**
 * Internal state for sync queue store.
 * Uses WeakMap for proper encapsulation without exposing internals.
 */
interface SyncQueueInternals {
  jobs: Map<string, StoredJob[]>;
  options: Required<SyncConfig>;
}

/**
 * WeakMap to store internal state without exposing it on the store object.
 * This prevents type assertion hacks and maintains proper encapsulation.
 */
const syncQueueInternals = new WeakMap<QueueStore, SyncQueueInternals>();

/**
 * Create a sync queue store for development/testing.
 *
 * @param config - Sync configuration
 * @returns Queue store implementation
 *
 * @example
 * ```typescript
 * const store = createSyncStore({ throwOnError: false });
 *
 * // Jobs are stored in memory, not processed until worker is started
 * await store.add('email.welcome', { userId: '123' }, {
 *   queue: 'default',
 * });
 * ```
 */
export function createSyncStore(config: SyncConfig = {}): QueueStore {
  const options = { ...DEFAULT_CONFIG, ...config };

  // In-memory job storage by queue
  const jobs = new Map<string, StoredJob[]>();

  /**
   * Get jobs for a queue.
   */
  function getQueueJobs(queueName: string): StoredJob[] {
    let queueJobs = jobs.get(queueName);
    if (!queueJobs) {
      queueJobs = [];
      jobs.set(queueName, queueJobs);
    }
    return queueJobs;
  }

  const store: QueueStore = {
    async add<T>(
      jobName: string,
      data: T,
      addOptions: {
        queue: string;
        delay?: number;
        jobOptions?: JobOptions;
      }
    ): Promise<string> {
      const id = generateJobId();
      const queueJobs = getQueueJobs(addOptions.queue);

      queueJobs.push({
        id,
        name: jobName,
        queue: addOptions.queue,
        data,
        delay: addOptions.delay,
        jobOptions: addOptions.jobOptions,
        status: 'pending',
        attemptsMade: 0,
        createdAt: new Date(),
      });

      return id;
    },

    async addBulk<T>(
      bulkJobs: Array<{
        jobName: string;
        data: T;
        options: {
          queue: string;
          delay?: number;
          jobOptions?: JobOptions;
        };
      }>
    ): Promise<string[]> {
      const ids: string[] = [];

      for (const job of bulkJobs) {
        const id = await store.add(job.jobName, job.data, job.options);
        ids.push(id);
      }

      return ids;
    },

    async getFailedJobs(queueName?: string, limit = 100): Promise<FailedJob[]> {
      const targetQueues = queueName ? [queueName] : Array.from(jobs.keys());
      const failedJobs: FailedJob[] = [];

      for (const name of targetQueues) {
        const queueJobs = jobs.get(name) ?? [];
        const failed = queueJobs
          .filter((job) => job.status === 'failed')
          .map((job) => ({
            id: job.id,
            name: job.name,
            queue: job.queue,
            data: job.data,
            error: job.error ?? 'Unknown error',
            stackTrace: job.stackTrace,
            attemptsMade: job.attemptsMade,
            failedAt: job.failedAt ?? new Date(),
          }));
        failedJobs.push(...failed);
      }

      return failedJobs.slice(0, limit);
    },

    async retryJob(jobId: string, queueName: string): Promise<boolean> {
      const queueJobs = jobs.get(queueName);
      if (!queueJobs) return false;

      const job = queueJobs.find((j) => j.id === jobId);
      if (!job || job.status !== 'failed') return false;

      job.status = 'pending';
      job.error = undefined;
      job.stackTrace = undefined;
      job.failedAt = undefined;
      return true;
    },

    async retryAllFailed(queueName?: string): Promise<number> {
      const targetQueues = queueName ? [queueName] : Array.from(jobs.keys());
      let retriedCount = 0;

      for (const name of targetQueues) {
        const queueJobs = jobs.get(name) ?? [];
        for (const job of queueJobs) {
          if (job.status === 'failed') {
            job.status = 'pending';
            job.error = undefined;
            job.stackTrace = undefined;
            job.failedAt = undefined;
            retriedCount++;
          }
        }
      }

      return retriedCount;
    },

    async removeJob(jobId: string, queueName: string): Promise<boolean> {
      const queueJobs = jobs.get(queueName);
      if (!queueJobs) return false;

      const index = queueJobs.findIndex((j) => j.id === jobId);
      if (index === -1) return false;

      queueJobs.splice(index, 1);
      return true;
    },

    async getStats(queueName?: string): Promise<QueueStats[]> {
      const targetQueues = queueName ? [queueName] : Array.from(jobs.keys());
      const stats: QueueStats[] = [];
      const now = Date.now();

      for (const name of targetQueues) {
        const queueJobs = jobs.get(name) ?? [];

        // A job is delayed if it has a delay and the delay hasn't elapsed yet
        const delayedCount = queueJobs.filter((j) => {
          if (j.status !== 'pending' || !j.delay) return false;
          const readyTime = j.createdAt.getTime() + j.delay;
          return now < readyTime;
        }).length;

        stats.push({
          name,
          waiting: queueJobs.filter((j) => j.status === 'pending').length - delayedCount,
          active: queueJobs.filter((j) => j.status === 'active').length,
          completed: queueJobs.filter((j) => j.status === 'completed').length,
          failed: queueJobs.filter((j) => j.status === 'failed').length,
          delayed: delayedCount,
          paused: false,
        });
      }

      return stats;
    },

    async pauseQueue(_queueName: string): Promise<void> {
      // No-op for sync driver
    },

    async resumeQueue(_queueName: string): Promise<void> {
      // No-op for sync driver
    },

    async clearQueue(queueName: string): Promise<void> {
      jobs.set(queueName, []);
    },

    async close(): Promise<void> {
      jobs.clear();
    },
  };

  // Store internals in WeakMap for proper encapsulation
  syncQueueInternals.set(store, { jobs, options });

  return store;
}

/**
 * Create a sync worker store for processing jobs immediately.
 *
 * @param store - Sync queue store (must be created with createSyncStore)
 * @returns Worker store implementation
 *
 * @example
 * ```typescript
 * const store = createSyncStore();
 * const worker = createSyncWorker(store);
 *
 * worker.registerHandler('email.welcome', async ({ data }) => {
 *   await sendEmail(data.email, 'Welcome!');
 * }, { queue: 'default' });
 *
 * // Process all pending jobs
 * await worker.start();
 * ```
 */
export function createSyncWorker(store: QueueStore): WorkerStore {
  // Get internals from WeakMap
  const internals = syncQueueInternals.get(store);
  if (!internals) {
    throw new Error(
      'Invalid sync queue store. Use createSyncStore() to create a compatible store.'
    );
  }

  const { jobs, options } = internals;

  const handlers = new Map<
    string,
    {
      handler: JobHandler<unknown>;
      options: {
        queue: string;
        concurrency: number;
        jobOptions?: JobOptions;
      };
    }
  >();

  let isRunning = false;

  /**
   * Remove a job from the queue.
   */
  function removeJob(queueJobs: StoredJob[], jobId: string): void {
    const index = queueJobs.findIndex((j) => j.id === jobId);
    if (index !== -1) {
      queueJobs.splice(index, 1);
    }
  }

  const workerStore: WorkerStore = {
    registerHandler<T>(
      jobName: string,
      handler: JobHandler<T>,
      registerOptions: {
        queue: string;
        concurrency?: number;
        jobOptions?: JobOptions;
      }
    ): void {
      handlers.set(jobName, {
        handler: handler as JobHandler<unknown>,
        options: {
          queue: registerOptions.queue,
          concurrency: registerOptions.concurrency ?? 1,
          jobOptions: registerOptions.jobOptions,
        },
      });
    },

    async start(): Promise<void> {
      isRunning = true;

      // Process all pending jobs synchronously
      for (const [queueName, queueJobs] of Array.from(jobs.entries())) {
        const now = Date.now();

        // Filter jobs that are pending AND ready (delay has elapsed)
        const readyJobs = queueJobs.filter((j: StoredJob) => {
          if (j.status !== 'pending') return false;

          // Check if delay has elapsed
          if (j.delay) {
            const readyTime = j.createdAt.getTime() + j.delay;
            return now >= readyTime;
          }

          return true;
        });

        for (const job of readyJobs) {
          if (!isRunning) break;

          const handlerInfo = handlers.get(job.name);
          if (!handlerInfo) {
            job.status = 'failed';
            job.error = `No handler registered for job: ${job.name}`;
            job.failedAt = new Date();
            continue;
          }

          job.status = 'active';
          job.attemptsMade++;

          const context: JobContext = {
            data: job.data,
            jobId: job.id,
            queueName,
            attemptNumber: job.attemptsMade,
            progress: async () => {
              // No-op for sync driver
            },
            log: async (message: string) => {
              console.log(`[Job ${job.id}] ${message}`);
            },
          };

          try {
            await handlerInfo.handler(context);
            job.status = 'completed';

            // Clean up completed job if removeOnComplete is enabled
            const removeOnComplete =
              job.jobOptions?.removeOnComplete ??
              handlerInfo.options.jobOptions?.removeOnComplete ??
              false;

            if (removeOnComplete) {
              removeJob(queueJobs, job.id);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const stackTrace = error instanceof Error ? error.stack : undefined;

            // Check for retries
            const maxAttempts =
              job.jobOptions?.attempts ?? handlerInfo.options.jobOptions?.attempts ?? 3;

            if (job.attemptsMade < maxAttempts) {
              job.status = 'pending';
            } else {
              job.status = 'failed';
              job.error = errorMessage;
              job.stackTrace = stackTrace;
              job.failedAt = new Date();

              // Clean up failed job if removeOnFail is enabled
              const removeOnFail =
                job.jobOptions?.removeOnFail ??
                handlerInfo.options.jobOptions?.removeOnFail ??
                false;

              if (removeOnFail) {
                removeJob(queueJobs, job.id);
              }
            }

            if (options.throwOnError && job.status === 'failed') {
              throw error;
            }
          }
        }
      }
    },

    async stop(): Promise<void> {
      isRunning = false;
    },

    async close(): Promise<void> {
      isRunning = false;
      handlers.clear();
    },
  };

  return workerStore;
}

/**
 * Sync driver name.
 */
export const DRIVER_NAME = 'sync' as const;
