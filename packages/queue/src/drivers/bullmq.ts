/**
 * BullMQ Driver
 *
 * Production-ready queue driver using BullMQ and Redis.
 */

import { type Job, Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';

import type {
  BullMQConfig,
  FailedJob,
  JobContext,
  JobHandler,
  JobOptions,
  QueueStats,
  QueueStore,
  WorkerStore,
} from '../types.js';

/**
 * Default configuration for BullMQ.
 */
const DEFAULT_CONFIG: Required<Omit<BullMQConfig, 'url' | 'password'>> = {
  host: 'localhost',
  port: 6379,
  db: 0,
  prefix: 'velox:queue:',
  defaultConcurrency: 1,
};

/**
 * Create Redis connection options from config.
 */
function createRedisOptions(config: BullMQConfig): {
  host: string;
  port: number;
  password?: string;
  db: number;
} {
  if (config.url) {
    const url = new URL(config.url);
    // Decode password - URL-encoded special characters need decoding
    // e.g., "p%40ssword" -> "p@ssword"
    const password = url.password ? decodeURIComponent(url.password) : undefined;
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      password,
      db: parseInt(url.pathname.slice(1), 10) || 0,
    };
  }

  return {
    host: config.host ?? DEFAULT_CONFIG.host,
    port: config.port ?? DEFAULT_CONFIG.port,
    password: config.password,
    db: config.db ?? DEFAULT_CONFIG.db,
  };
}

/**
 * Create a BullMQ queue store.
 *
 * @param config - BullMQ configuration
 * @returns Queue store implementation
 *
 * @example
 * ```typescript
 * const store = await createBullMQStore({
 *   url: process.env.REDIS_URL,
 *   prefix: 'myapp:queue:',
 * });
 *
 * await store.add('email.welcome', { userId: '123' }, {
 *   queue: 'default',
 *   delay: 5000,
 * });
 * ```
 */
export async function createBullMQStore(config: BullMQConfig = {}): Promise<QueueStore> {
  const options = { ...DEFAULT_CONFIG, ...config };
  const redisOptions = createRedisOptions(config);

  // Dynamic import of ioredis to keep it as peer dependency
  const { Redis } = await import('ioredis');

  // Create Redis connection for queue operations
  const connection: Redis = new Redis({
    ...redisOptions,
    maxRetriesPerRequest: null, // Required for BullMQ
  });

  // Verify connection is healthy before proceeding
  // This prevents connection leaks if subsequent initialization fails
  try {
    await connection.ping();
  } catch (error) {
    // Clean up connection on initialization failure
    await connection.quit().catch(() => {});
    throw error;
  }

  // Queue instances cache
  const queues = new Map<string, Queue>();

  /**
   * Get or create a queue instance.
   */
  function getQueue(queueName: string): Queue {
    let queue = queues.get(queueName);
    if (!queue) {
      queue = new Queue(queueName, {
        connection,
        prefix: options.prefix,
      });
      queues.set(queueName, queue);
    }
    return queue;
  }

  /**
   * Convert BullMQ job options to our format.
   */
  function toBullMQOptions(jobOptions?: JobOptions) {
    if (!jobOptions) return {};

    return {
      attempts: jobOptions.attempts,
      backoff: jobOptions.backoff,
      priority: jobOptions.priority,
      removeOnComplete: jobOptions.removeOnComplete,
      removeOnFail: jobOptions.removeOnFail,
      timeout: jobOptions.timeout,
    };
  }

  /**
   * Convert BullMQ job to FailedJob format.
   */
  function toFailedJob(job: Job, queueName: string): FailedJob {
    return {
      id: job.id ?? '',
      name: job.name,
      queue: queueName,
      data: job.data,
      error: job.failedReason ?? 'Unknown error',
      stackTrace: job.stacktrace?.join('\n'),
      attemptsMade: job.attemptsMade,
      failedAt: new Date(job.finishedOn ?? Date.now()),
    };
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
      const queue = getQueue(addOptions.queue);
      const job = await queue.add(jobName, data, {
        ...toBullMQOptions(addOptions.jobOptions),
        delay: addOptions.delay,
      });
      return job.id ?? '';
    },

    async addBulk<T>(
      jobs: Array<{
        jobName: string;
        data: T;
        options: {
          queue: string;
          delay?: number;
          jobOptions?: JobOptions;
        };
      }>
    ): Promise<string[]> {
      // Group jobs by queue
      const jobsByQueue = new Map<
        string,
        Array<{
          name: string;
          data: T;
          opts?: ReturnType<typeof toBullMQOptions> & { delay?: number };
        }>
      >();

      for (const job of jobs) {
        const queueJobs = jobsByQueue.get(job.options.queue) ?? [];
        queueJobs.push({
          name: job.jobName,
          data: job.data,
          opts: {
            ...toBullMQOptions(job.options.jobOptions),
            delay: job.options.delay,
          },
        });
        jobsByQueue.set(job.options.queue, queueJobs);
      }

      // Add jobs to all queues in parallel for better performance
      const queueEntries = Array.from(jobsByQueue.entries());
      const jobIdArrays = await Promise.all(
        queueEntries.map(async ([queueName, queueJobs]) => {
          const queue = getQueue(queueName);
          const addedJobs = await queue.addBulk(queueJobs);
          return addedJobs.map((j) => j.id ?? '');
        })
      );

      // Flatten job IDs while preserving order
      return jobIdArrays.flat();
    },

    async getFailedJobs(queueName?: string, limit = 100): Promise<FailedJob[]> {
      const targetQueues = queueName ? [queueName] : Array.from(queues.keys());

      if (targetQueues.length === 0) {
        return [];
      }

      // Fetch failed jobs from all queues in parallel
      const failedJobArrays = await Promise.all(
        targetQueues.map(async (name) => {
          const queue = getQueue(name);
          const jobs = await queue.getFailed(0, limit);
          return jobs.map((job) => toFailedJob(job, name));
        })
      );

      // Flatten and limit results
      return failedJobArrays.flat().slice(0, limit);
    },

    async retryJob(jobId: string, queueName: string): Promise<boolean> {
      const queue = getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (!job) {
        return false;
      }

      await job.retry();
      return true;
    },

    async retryAllFailed(queueName?: string): Promise<number> {
      const targetQueues = queueName ? [queueName] : Array.from(queues.keys());

      if (targetQueues.length === 0) {
        return 0;
      }

      // Process all queues in parallel for better performance
      const retryResults = await Promise.all(
        targetQueues.map(async (name) => {
          const queue = getQueue(name);
          const failedJobs = await queue.getFailed();

          if (failedJobs.length === 0) {
            return 0;
          }

          await Promise.all(failedJobs.map((job) => job.retry()));
          return failedJobs.length;
        })
      );

      return retryResults.reduce((sum, count) => sum + count, 0);
    },

    async removeJob(jobId: string, queueName: string): Promise<boolean> {
      const queue = getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (!job) {
        return false;
      }

      await job.remove();
      return true;
    },

    async getStats(queueName?: string): Promise<QueueStats[]> {
      const targetQueues = queueName ? [queueName] : Array.from(queues.keys());

      if (targetQueues.length === 0) {
        return [];
      }

      // Fetch stats for all queues in parallel for better performance
      const statsPromises = targetQueues.map(async (name) => {
        const queue = getQueue(name);
        // Fetch job counts and paused status concurrently for each queue
        const [counts, isPaused] = await Promise.all([queue.getJobCounts(), queue.isPaused()]);

        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          paused: isPaused,
        };
      });

      return Promise.all(statsPromises);
    },

    async pauseQueue(queueName: string): Promise<void> {
      const queue = getQueue(queueName);
      await queue.pause();
    },

    async resumeQueue(queueName: string): Promise<void> {
      const queue = getQueue(queueName);
      await queue.resume();
    },

    async clearQueue(queueName: string): Promise<void> {
      const queue = getQueue(queueName);
      await queue.drain();
    },

    async close(): Promise<void> {
      // Close all queue instances in parallel for better performance
      const queueInstances = Array.from(queues.values());
      if (queueInstances.length > 0) {
        await Promise.all(queueInstances.map((queue) => queue.close()));
      }
      queues.clear();

      // Close Redis connection
      await connection.quit();
    },
  };

  return store;
}

/**
 * Create a BullMQ worker store for processing jobs.
 *
 * @param config - BullMQ configuration
 * @returns Worker store implementation
 *
 * @example
 * ```typescript
 * const worker = await createBullMQWorker({
 *   url: process.env.REDIS_URL,
 * });
 *
 * worker.registerHandler('email.welcome', async ({ data }) => {
 *   await sendEmail(data.email, 'Welcome!');
 * }, { queue: 'default' });
 *
 * await worker.start();
 * ```
 */
export async function createBullMQWorker(config: BullMQConfig = {}): Promise<WorkerStore> {
  const options = { ...DEFAULT_CONFIG, ...config };
  const redisOptions = createRedisOptions(config);

  // Dynamic import of ioredis
  const { Redis } = await import('ioredis');

  // Create Redis connection for worker
  const connection: Redis = new Redis({
    ...redisOptions,
    maxRetriesPerRequest: null,
  });

  // Handler registry
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

  // Worker instances
  const workers = new Map<string, Worker>();

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
          concurrency: registerOptions.concurrency ?? options.defaultConcurrency,
          jobOptions: registerOptions.jobOptions,
        },
      });
    },

    async start(): Promise<void> {
      // Group handlers by queue
      const handlersByQueue = new Map<
        string,
        Map<string, { handler: JobHandler<unknown>; concurrency: number }>
      >();

      for (const [jobName, info] of Array.from(handlers.entries())) {
        const queueHandlers = handlersByQueue.get(info.options.queue) ?? new Map();
        queueHandlers.set(jobName, {
          handler: info.handler,
          concurrency: info.options.concurrency,
        });
        handlersByQueue.set(info.options.queue, queueHandlers);
      }

      // Create workers for each queue with cleanup on partial failure
      for (const [queueName, queueHandlers] of Array.from(handlersByQueue.entries())) {
        // Find minimum concurrency for this queue
        const concurrency = Math.min(
          ...Array.from(queueHandlers.values()).map((h) => h.concurrency)
        );

        let worker: Worker;
        try {
          worker = new Worker(
            queueName,
            async (job: Job) => {
              const handlerInfo = queueHandlers.get(job.name);
              if (!handlerInfo) {
                throw new Error(`No handler registered for job: ${job.name}`);
              }

              const context: JobContext = {
                data: job.data,
                jobId: job.id ?? '',
                queueName,
                attemptNumber: job.attemptsMade + 1,
                progress: async (value: number) => {
                  await job.updateProgress(value);
                },
                log: async (message: string) => {
                  await job.log(message);
                },
              };

              await handlerInfo.handler(context);
            },
            {
              connection,
              prefix: options.prefix,
              concurrency,
            }
          );
        } catch (error) {
          // Clean up already-created workers before rethrowing
          // Prevents memory leak on partial initialization failure
          const existingWorkers = Array.from(workers.values());
          await Promise.all(existingWorkers.map((w) => w.close().catch(() => {})));
          workers.clear();
          throw error;
        }

        workers.set(queueName, worker);
      }
    },

    async stop(): Promise<void> {
      // Pause all workers in parallel for better performance
      const workerInstances = Array.from(workers.values());
      if (workerInstances.length > 0) {
        await Promise.all(workerInstances.map((worker) => worker.pause()));
      }
    },

    async close(): Promise<void> {
      // Close all workers in parallel for better performance
      const workerInstances = Array.from(workers.values());
      if (workerInstances.length > 0) {
        await Promise.all(workerInstances.map((worker) => worker.close()));
      }
      workers.clear();
      handlers.clear();

      // Close Redis connection
      await connection.quit();
    },
  };

  return workerStore;
}

/**
 * BullMQ driver name.
 */
export const DRIVER_NAME = 'bullmq' as const;
