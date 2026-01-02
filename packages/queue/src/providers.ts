/**
 * DI Providers for @veloxts/queue
 *
 * Factory provider functions for registering queue services with the DI container.
 * These providers allow services to be managed by the container for testability and flexibility.
 *
 * @module queue/providers
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerQueueProviders, QUEUE_MANAGER } from '@veloxts/queue';
 *
 * const container = new Container();
 * await registerQueueProviders(container, { driver: 'sync' });
 *
 * const queue = container.resolve(QUEUE_MANAGER);
 * await queue.dispatch(myJob, { data: 'value' });
 * ```
 */

import type { Container } from '@veloxts/core';

import { createQueueManager, createWorkerManager } from './manager.js';
import { QUEUE_CONFIG, QUEUE_MANAGER, WORKER_MANAGER } from './tokens.js';
import type { QueuePluginOptions } from './types.js';

// ============================================================================
// Bulk Registration Helpers
// ============================================================================

/**
 * Options for registering queue providers
 */
export type RegisterQueueProvidersOptions = QueuePluginOptions & {
  /**
   * Whether to also register a worker manager.
   * @default false
   */
  includeWorker?: boolean;
};

/**
 * Registers queue providers with a container
 *
 * This handles async initialization of the queue manager and optionally
 * the worker manager, registering the resolved instances directly for
 * synchronous resolution.
 *
 * @param container - The DI container to register providers with
 * @param config - Queue plugin options (driver, prefix, etc.)
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerQueueProviders, QUEUE_MANAGER, WORKER_MANAGER } from '@veloxts/queue';
 *
 * const container = new Container();
 *
 * // Sync driver (development/testing)
 * await registerQueueProviders(container, { driver: 'sync' });
 *
 * // BullMQ driver (production) with worker
 * await registerQueueProviders(container, {
 *   driver: 'bullmq',
 *   config: { url: process.env.REDIS_URL },
 *   includeWorker: true,
 * });
 *
 * const queue = container.resolve(QUEUE_MANAGER);
 * await queue.dispatch(myJob, { userId: '123' });
 *
 * // If includeWorker was true:
 * const worker = container.resolve(WORKER_MANAGER);
 * worker.register(myJob);
 * await worker.start();
 * ```
 */
export async function registerQueueProviders(
  container: Container,
  config: RegisterQueueProvidersOptions = {}
): Promise<void> {
  const { includeWorker, ...queueConfig } = config;

  // Register config
  container.register({
    provide: QUEUE_CONFIG,
    useValue: queueConfig,
  });

  // Create queue manager (async operation)
  const queueManager = await createQueueManager(queueConfig);

  // Register the resolved queue manager instance directly
  // This allows synchronous resolution from the container
  container.register({
    provide: QUEUE_MANAGER,
    useValue: queueManager,
  });

  // Optionally create and register worker manager
  if (includeWorker) {
    const workerManager = await createWorkerManager(queueConfig);
    container.register({
      provide: WORKER_MANAGER,
      useValue: workerManager,
    });
  }
}
