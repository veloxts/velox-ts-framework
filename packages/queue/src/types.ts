/**
 * Queue Types
 *
 * Type definitions for VeloxTS queue system.
 */

import type { z } from 'zod';

/**
 * Duration string format (e.g., '30s', '5m', '1h', '1d').
 */
export type DurationString = `${number}${'s' | 'm' | 'h' | 'd' | 'w'}`;

/**
 * Delay value - seconds (number) or duration string.
 */
export type Delay = number | DurationString;

/**
 * Available queue drivers.
 */
export type QueueDriver = 'bullmq' | 'sync';

/**
 * Backoff strategy for failed jobs.
 */
export interface BackoffOptions {
  /**
   * Backoff type.
   * - 'fixed': Wait the same delay each retry
   * - 'exponential': Delay doubles each retry
   */
  type: 'fixed' | 'exponential';

  /**
   * Initial delay in milliseconds.
   */
  delay: number;
}

/**
 * Job options for controlling execution behavior.
 */
export interface JobOptions {
  /**
   * Number of retry attempts on failure.
   * @default 3
   */
  attempts?: number;

  /**
   * Backoff strategy for retries.
   */
  backoff?: BackoffOptions;

  /**
   * Job priority (lower = higher priority).
   * @default 0
   */
  priority?: number;

  /**
   * Remove job from queue after completion.
   * @default true
   */
  removeOnComplete?: boolean | number;

  /**
   * Remove job from queue after failure.
   * @default false
   */
  removeOnFail?: boolean | number;

  /**
   * Job timeout in milliseconds.
   */
  timeout?: number;
}

/**
 * Dispatch options when adding a job to the queue.
 */
export interface DispatchOptions {
  /**
   * Delay before job is processed.
   */
  delay?: Delay;

  /**
   * Override default queue name.
   */
  queue?: string;

  /**
   * Override default job options.
   */
  jobOptions?: JobOptions;
}

/**
 * Job handler context.
 */
export interface JobContext<T = unknown> {
  /**
   * Job payload data.
   */
  data: T;

  /**
   * Job ID.
   */
  jobId: string;

  /**
   * Queue name.
   */
  queueName: string;

  /**
   * Current attempt number (1-based).
   */
  attemptNumber: number;

  /**
   * Report job progress (0-100).
   */
  progress(value: number): Promise<void>;

  /**
   * Log a message for this job.
   */
  log(message: string): Promise<void>;
}

/**
 * Job handler function.
 */
export type JobHandler<T> = (context: JobContext<T>) => Promise<void>;

/**
 * Job definition configuration.
 */
export interface JobDefinitionConfig<TSchema extends z.ZodType> {
  /**
   * Unique job name (e.g., 'email.welcome', 'payment.process').
   */
  name: string;

  /**
   * Zod schema for job payload validation.
   */
  schema: TSchema;

  /**
   * Job handler function.
   */
  handler: JobHandler<z.infer<TSchema>>;

  /**
   * Default job options.
   */
  options?: JobOptions;

  /**
   * Default queue name.
   * @default 'default'
   */
  queue?: string;
}

/**
 * Job definition - type-safe job with schema validation.
 */
export interface JobDefinition<TSchema extends z.ZodType> {
  /**
   * Unique job name.
   */
  readonly name: string;

  /**
   * Zod schema for payload validation.
   */
  readonly schema: TSchema;

  /**
   * Job handler function.
   */
  readonly handler: JobHandler<z.infer<TSchema>>;

  /**
   * Default job options.
   */
  readonly options: JobOptions;

  /**
   * Default queue name.
   */
  readonly queue: string;
}

/**
 * BullMQ driver configuration.
 */
export interface BullMQConfig {
  /**
   * Redis connection URL.
   */
  url?: string;

  /**
   * Redis host.
   * @default 'localhost'
   */
  host?: string;

  /**
   * Redis port.
   * @default 6379
   */
  port?: number;

  /**
   * Redis password.
   */
  password?: string;

  /**
   * Redis database number.
   * @default 0
   */
  db?: number;

  /**
   * Key prefix for queue data.
   * @default 'velox:queue:'
   */
  prefix?: string;

  /**
   * Default concurrency for workers.
   * @default 1
   */
  defaultConcurrency?: number;
}

/**
 * Sync driver configuration (for development/testing).
 */
export interface SyncConfig {
  /**
   * Whether to throw errors from handlers.
   * @default true
   */
  throwOnError?: boolean;
}

/**
 * Queue configuration by driver.
 */
export type QueueConfig =
  | { driver: 'bullmq'; config?: BullMQConfig }
  | { driver: 'sync'; config?: SyncConfig };

/**
 * Queue plugin options.
 */
export interface QueuePluginOptions {
  /**
   * Queue driver to use.
   * @default 'bullmq'
   */
  driver?: QueueDriver;

  /**
   * Driver-specific configuration.
   */
  config?: BullMQConfig | SyncConfig;

  /**
   * Default queue name.
   * @default 'default'
   */
  defaultQueue?: string;

  /**
   * Available queue names.
   * @default ['high', 'default', 'low']
   */
  queues?: string[];
}

/**
 * Failed job information.
 */
export interface FailedJob {
  /**
   * Job ID.
   */
  id: string;

  /**
   * Job name.
   */
  name: string;

  /**
   * Queue name.
   */
  queue: string;

  /**
   * Job payload data.
   */
  data: unknown;

  /**
   * Error message.
   */
  error: string;

  /**
   * Stack trace.
   */
  stackTrace?: string;

  /**
   * Number of attempts made.
   */
  attemptsMade: number;

  /**
   * Timestamp when job failed.
   */
  failedAt: Date;
}

/**
 * Queue statistics.
 */
export interface QueueStats {
  /**
   * Queue name.
   */
  name: string;

  /**
   * Jobs waiting to be processed.
   */
  waiting: number;

  /**
   * Jobs currently being processed.
   */
  active: number;

  /**
   * Completed jobs (if kept).
   */
  completed: number;

  /**
   * Failed jobs.
   */
  failed: number;

  /**
   * Delayed jobs.
   */
  delayed: number;

  /**
   * Paused status.
   */
  paused: boolean;
}

/**
 * Queue store interface for driver implementations.
 */
export interface QueueStore {
  /**
   * Add a job to the queue.
   */
  add<T>(
    jobName: string,
    data: T,
    options: {
      queue: string;
      delay?: number;
      jobOptions?: JobOptions;
    }
  ): Promise<string>;

  /**
   * Add multiple jobs to the queue.
   */
  addBulk<T>(
    jobs: Array<{
      jobName: string;
      data: T;
      options: {
        queue: string;
        delay?: number;
        jobOptions?: JobOptions;
      };
    }>
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
   * Remove a job.
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
 * Worker store interface for driver implementations.
 */
export interface WorkerStore {
  /**
   * Register a job handler.
   */
  registerHandler<T>(
    jobName: string,
    handler: JobHandler<T>,
    options: {
      queue: string;
      concurrency?: number;
      jobOptions?: JobOptions;
    }
  ): void;

  /**
   * Start processing jobs.
   */
  start(): Promise<void>;

  /**
   * Stop processing jobs.
   */
  stop(): Promise<void>;

  /**
   * Close connections.
   */
  close(): Promise<void>;
}
