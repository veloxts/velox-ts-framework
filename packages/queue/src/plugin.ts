/**
 * Queue Plugin
 *
 * VeloxTS plugin for integrating job queues into the framework.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { createQueueManager, type QueueManager } from './manager.js';
import type { QueuePluginOptions } from './types.js';

/**
 * Symbol for storing queue manager on Fastify instance.
 * Using a symbol prevents naming conflicts with other plugins.
 */
const QUEUE_MANAGER_KEY = Symbol.for('@veloxts/queue:manager');

/**
 * Extend Fastify types with queue manager.
 */
declare module 'fastify' {
  interface FastifyInstance {
    [QUEUE_MANAGER_KEY]?: QueueManager;
  }

  interface FastifyRequest {
    queue?: QueueManager;
  }
}

/**
 * Standalone queue instance for CLI commands and background jobs.
 * This is separate from the plugin to avoid test isolation issues.
 */
let standaloneQueueInstance: QueueManager | null = null;

/**
 * Create the queue plugin for VeloxTS.
 *
 * Each Fastify instance gets its own queue manager, ensuring proper test isolation
 * and supporting multiple Fastify instances in the same process.
 *
 * @param options - Queue plugin options
 * @returns Fastify plugin
 *
 * @example
 * ```typescript
 * import { createApp } from '@veloxts/core';
 * import { queuePlugin } from '@veloxts/queue';
 *
 * const app = createApp();
 *
 * app.use(queuePlugin({
 *   driver: 'bullmq',
 *   config: { url: process.env.REDIS_URL },
 * }));
 *
 * // In procedures:
 * await ctx.queue.dispatch(sendWelcomeEmail, { userId: '123' });
 * ```
 */
export function queuePlugin(options: QueuePluginOptions = {}) {
  return fp(
    async (fastify: FastifyInstance) => {
      // Create a new queue manager for this Fastify instance
      const queueManager = await createQueueManager(options);

      // Store on Fastify instance using symbol key
      (fastify as unknown as Record<symbol, QueueManager>)[QUEUE_MANAGER_KEY] = queueManager;

      // Decorate the request with queue manager
      fastify.decorateRequest('queue', undefined);

      // Add queue to request context
      fastify.addHook('onRequest', async (request: FastifyRequest) => {
        request.queue = queueManager;
      });

      // Close queue on server shutdown
      fastify.addHook('onClose', async () => {
        await queueManager.close();
      });
    },
    {
      name: '@veloxts/queue',
      fastify: '5.x',
    }
  );
}

/**
 * Get the queue manager from a Fastify instance.
 *
 * @param fastify - Fastify instance with queue plugin registered
 * @throws Error if queue plugin is not registered
 */
export function getQueueFromInstance(fastify: FastifyInstance): QueueManager {
  const queue = (fastify as unknown as Record<symbol, QueueManager | undefined>)[QUEUE_MANAGER_KEY];
  if (!queue) {
    throw new Error(
      'Queue not initialized on this Fastify instance. Make sure to register queuePlugin first.'
    );
  }
  return queue;
}

/**
 * Initialize queue manager standalone (without Fastify).
 *
 * Useful for CLI commands or worker processes. This creates a separate
 * queue instance that is independent from any Fastify instances.
 *
 * @example
 * ```typescript
 * import { initQueue, closeQueue } from '@veloxts/queue';
 *
 * const queue = await initQueue({
 *   driver: 'bullmq',
 *   config: { url: process.env.REDIS_URL },
 * });
 *
 * // Use queue directly
 * await queue.dispatch(sendWelcomeEmail, { userId: '123' });
 *
 * // Clean up when done
 * await closeQueue();
 * ```
 */
export async function initQueue(options: QueuePluginOptions = {}): Promise<QueueManager> {
  if (!standaloneQueueInstance) {
    standaloneQueueInstance = await createQueueManager(options);
  }
  return standaloneQueueInstance;
}

/**
 * Get the standalone queue manager.
 *
 * @throws Error if queue is not initialized via initQueue()
 */
export function getQueue(): QueueManager {
  if (!standaloneQueueInstance) {
    throw new Error(
      'Standalone queue not initialized. Call initQueue() first, or use getQueueFromInstance() for Fastify-based usage.'
    );
  }
  return standaloneQueueInstance;
}

/**
 * Close the standalone queue connection.
 */
export async function closeQueue(): Promise<void> {
  if (standaloneQueueInstance) {
    await standaloneQueueInstance.close();
    standaloneQueueInstance = null;
  }
}

/**
 * Reset standalone queue instance (for testing purposes).
 * @internal
 */
export function _resetStandaloneQueue(): void {
  standaloneQueueInstance = null;
}
