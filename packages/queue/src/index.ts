/**
 * @veloxts/queue
 *
 * Background job processing for VeloxTS framework.
 *
 * Features:
 * - Multiple drivers: BullMQ (production), Sync (development/testing)
 * - Type-safe job definitions with Zod schemas
 * - Automatic retry with configurable backoff
 * - Job batching and priority queues
 * - Progress tracking and logging
 * - Failed job management
 * - Graceful shutdown support
 *
 * @example
 * ```typescript
 * import { queuePlugin, defineJob } from '@veloxts/queue';
 * import { z } from 'zod';
 *
 * // Define a job
 * export const sendWelcomeEmail = defineJob({
 *   name: 'email.welcome',
 *   schema: z.object({
 *     userId: z.string().uuid(),
 *     email: z.string().email(),
 *   }),
 *   handler: async ({ data, progress }) => {
 *     await progress(50);
 *     await sendEmail(data.email, 'Welcome!');
 *     await progress(100);
 *   },
 * });
 *
 * // Register plugin
 * app.use(queuePlugin({
 *   driver: 'bullmq',
 *   config: { url: process.env.REDIS_URL },
 * }));
 *
 * // Dispatch job
 * await ctx.queue.dispatch(sendWelcomeEmail, {
 *   userId: '123',
 *   email: 'user@example.com',
 * });
 * ```
 *
 * @packageDocumentation
 */

// Drivers
export {
  createBullMQStore,
  createBullMQWorker,
  DRIVER_NAME as BULLMQ_DRIVER,
} from './drivers/bullmq.js';
export { createSyncStore, createSyncWorker, DRIVER_NAME as SYNC_DRIVER } from './drivers/sync.js';
// Job definition
export { defineJob, job } from './job.js';
// Manager
export {
  createQueueManager,
  createWorkerManager,
  type QueueManager,
  queue,
  type WorkerManager,
} from './manager.js';
// Plugin
export {
  closeQueue,
  getQueue,
  getQueueFromInstance,
  initQueue,
  queuePlugin,
} from './plugin.js';
// Types
export type {
  BackoffOptions,
  BullMQConfig,
  Delay,
  DispatchOptions,
  DurationString,
  FailedJob,
  JobContext,
  JobDefinition,
  JobDefinitionConfig,
  JobHandler,
  JobOptions,
  QueueConfig,
  QueueDriver,
  QueuePluginOptions,
  QueueStats,
  QueueStore,
  SyncConfig,
  WorkerStore,
} from './types.js';
// Utilities
export { formatDuration, isDurationString, parseDelay, validateJobName } from './utils.js';
