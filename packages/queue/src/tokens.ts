/**
 * DI Tokens for @veloxts/queue
 *
 * Symbol-based tokens for type-safe dependency injection.
 * These tokens allow queue services to be registered, resolved, and mocked via the DI container.
 *
 * @module queue/tokens
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { QUEUE_MANAGER, registerQueueProviders } from '@veloxts/queue';
 *
 * const container = new Container();
 * await registerQueueProviders(container, { driver: 'sync' });
 *
 * const queue = container.resolve(QUEUE_MANAGER);
 * await queue.dispatch(myJob, { data: 'value' });
 * ```
 */

import { token } from '@veloxts/core';

import type { QueueManager, WorkerManager } from './manager.js';
import type { QueuePluginOptions, QueueStore, WorkerStore } from './types.js';

// ============================================================================
// Core Queue Tokens
// ============================================================================

/**
 * Queue manager token
 *
 * The main queue manager instance for dispatching and managing jobs.
 *
 * @example
 * ```typescript
 * const queue = container.resolve(QUEUE_MANAGER);
 * await queue.dispatch(sendWelcomeEmail, { userId: '123' });
 * await queue.getStats();
 * ```
 */
export const QUEUE_MANAGER = token.symbol<QueueManager>('QUEUE_MANAGER');

/**
 * Worker manager token
 *
 * The worker manager for processing jobs.
 *
 * @example
 * ```typescript
 * const worker = container.resolve(WORKER_MANAGER);
 * worker.register(sendWelcomeEmail);
 * await worker.start();
 * ```
 */
export const WORKER_MANAGER = token.symbol<WorkerManager>('WORKER_MANAGER');

/**
 * Queue store token
 *
 * The underlying queue store driver (BullMQ or Sync).
 * Use QUEUE_MANAGER for high-level operations; use this for direct store access.
 *
 * @example
 * ```typescript
 * const store = container.resolve(QUEUE_STORE);
 * await store.add('job-name', data, { queue: 'default' });
 * ```
 */
export const QUEUE_STORE = token.symbol<QueueStore>('QUEUE_STORE');

/**
 * Worker store token
 *
 * The underlying worker store driver for job processing.
 *
 * @example
 * ```typescript
 * const store = container.resolve(WORKER_STORE);
 * store.registerHandler('job-name', handler, { queue: 'default' });
 * ```
 */
export const WORKER_STORE = token.symbol<WorkerStore>('WORKER_STORE');

// ============================================================================
// Configuration Tokens
// ============================================================================

/**
 * Queue configuration token
 *
 * Contains queue plugin options including driver and driver-specific config.
 *
 * @example
 * ```typescript
 * const config = container.resolve(QUEUE_CONFIG);
 * console.log(config.driver); // 'bullmq' or 'sync'
 * ```
 */
export const QUEUE_CONFIG = token.symbol<QueuePluginOptions>('QUEUE_CONFIG');
