/**
 * Scheduler Plugin
 *
 * Fastify plugin for task scheduling.
 * Extends BaseContext with scheduler manager access.
 */

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

// Side-effect import for declaration merging
import '@veloxts/core';

import { createScheduler } from './manager.js';
import type { SchedulerManager, SchedulerPluginOptions } from './types.js';

/**
 * Extend BaseContext with scheduler manager.
 *
 * After registering the scheduler plugin, `ctx.scheduler` becomes available
 * in all procedures:
 *
 * @example
 * ```typescript
 * const getScheduleStatus = procedure.query(async ({ ctx }) => {
 *   return {
 *     running: ctx.scheduler.isRunning(),
 *     tasks: ctx.scheduler.getTasks().map(t => ({
 *       name: t.name,
 *       nextRun: ctx.scheduler.getNextRun(t.name),
 *     })),
 *   };
 * });
 * ```
 */
declare module '@veloxts/core' {
  interface BaseContext {
    /** Scheduler manager for task scheduling */
    scheduler: SchedulerManager;
  }
}

/**
 * Symbol for accessing scheduler manager from Fastify instance.
 */
const SCHEDULER_KEY = Symbol.for('velox.scheduler');

/**
 * Scheduler plugin for Fastify.
 *
 * Registers a scheduler manager and optionally starts it automatically.
 *
 * @param options - Scheduler plugin options
 *
 * @example
 * ```typescript
 * import { schedulerPlugin, task } from '@veloxts/scheduler';
 *
 * const schedule = [
 *   task('cleanup', async () => {
 *     await db.token.deleteMany({
 *       where: { expiresAt: { lt: new Date() } }
 *     });
 *   })
 *     .daily()
 *     .at('02:00')
 *     .timezone('America/New_York')
 *     .build(),
 *
 *   task('send-digest', async () => {
 *     await sendDailyDigest();
 *   })
 *     .daily()
 *     .at('09:00')
 *     .weekdays()
 *     .build(),
 * ];
 *
 * app.register(schedulerPlugin, {
 *   tasks: schedule,
 *   timezone: 'UTC',
 *   autoStart: true,
 *   onTaskStart: (task) => console.log(`Starting: ${task.name}`),
 *   onTaskComplete: (task, ctx, duration) => {
 *     console.log(`Completed: ${task.name} in ${duration}ms`);
 *   },
 * });
 * ```
 */
export function schedulerPlugin(options: SchedulerPluginOptions) {
  return fp(
    async (fastify: FastifyInstance) => {
      const {
        tasks,
        autoStart = process.env.NODE_ENV === 'production',
        ...schedulerOptions
      } = options;

      // Create scheduler manager
      const manager = createScheduler(tasks, schedulerOptions);

      // Store on fastify instance
      (fastify as unknown as Record<symbol, SchedulerManager>)[SCHEDULER_KEY] = manager;

      // Decorate request with scheduler accessor
      fastify.decorateRequest('scheduler', {
        getter() {
          return manager;
        },
      });

      // Auto-start if configured
      if (autoStart) {
        manager.start();
      }

      // Register cleanup hook
      fastify.addHook('onClose', async () => {
        await manager.stop();
      });
    },
    {
      name: '@veloxts/scheduler',
      fastify: '5.x',
    }
  );
}

/**
 * Get the scheduler manager from a Fastify instance.
 *
 * @param fastify - Fastify instance
 * @returns Scheduler manager
 * @throws If scheduler plugin is not registered
 *
 * @example
 * ```typescript
 * const scheduler = getSchedulerFromInstance(fastify);
 * await scheduler.runTask('cleanup');
 * ```
 */
export function getSchedulerFromInstance(fastify: FastifyInstance): SchedulerManager {
  const scheduler = (fastify as unknown as Record<symbol, SchedulerManager>)[SCHEDULER_KEY];

  if (!scheduler) {
    throw new Error(
      'Scheduler plugin not registered. Register it with: app.register(schedulerPlugin, { ... })'
    );
  }

  return scheduler;
}

// =============================================================================
// Standalone Usage (outside Fastify context)
// =============================================================================

/**
 * Singleton scheduler instance for standalone usage.
 */
let standaloneScheduler: SchedulerManager | null = null;

/**
 * Get or create a standalone scheduler manager.
 *
 * This is useful when you need scheduler access outside of a Fastify request
 * context, such as in CLI commands or background workers.
 *
 * @param options - Scheduler options (only used on first call)
 * @returns Scheduler manager instance
 *
 * @example
 * ```typescript
 * import { getScheduler, task } from '@veloxts/scheduler';
 *
 * // In a CLI command
 * const scheduler = getScheduler({
 *   tasks: [
 *     task('cleanup', () => cleanup()).daily().build(),
 *   ],
 * });
 *
 * scheduler.start();
 * ```
 */
export function getScheduler(options?: SchedulerPluginOptions): SchedulerManager {
  if (!standaloneScheduler && options) {
    standaloneScheduler = createScheduler(options.tasks, options);
  }

  if (!standaloneScheduler) {
    throw new Error('Scheduler not initialized. Provide options on first call.');
  }

  return standaloneScheduler;
}

/**
 * Reset the standalone scheduler instance.
 * Primarily used for testing.
 */
export async function _resetStandaloneScheduler(): Promise<void> {
  if (standaloneScheduler) {
    await standaloneScheduler.stop();
    standaloneScheduler = null;
  }
}
