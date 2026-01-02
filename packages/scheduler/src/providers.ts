/**
 * DI Providers for @veloxts/scheduler
 *
 * Factory provider functions for registering scheduler services with the DI container.
 * These providers allow services to be managed by the container for testability and flexibility.
 *
 * @module scheduler/providers
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerSchedulerProviders, SCHEDULER_MANAGER, task } from '@veloxts/scheduler';
 *
 * const container = new Container();
 * registerSchedulerProviders(container, {
 *   tasks: [
 *     task('cleanup', () => db.cleanup()).daily().at('02:00').build(),
 *   ],
 *   timezone: 'America/New_York',
 * });
 *
 * const scheduler = container.resolve(SCHEDULER_MANAGER);
 * scheduler.start();
 * ```
 */

import type { Container } from '@veloxts/core';

import { createScheduler } from './manager.js';
import { SCHEDULER_CONFIG, SCHEDULER_MANAGER } from './tokens.js';
import type { SchedulerPluginOptions } from './types.js';

// ============================================================================
// Bulk Registration Helpers
// ============================================================================

/**
 * Registers scheduler providers with a container
 *
 * Unlike other VeloxTS packages, the scheduler manager is created synchronously.
 *
 * @param container - The DI container to register providers with
 * @param config - Scheduler plugin options (tasks, timezone, callbacks, etc.)
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerSchedulerProviders, SCHEDULER_MANAGER, task } from '@veloxts/scheduler';
 *
 * const container = new Container();
 *
 * registerSchedulerProviders(container, {
 *   tasks: [
 *     task('cleanup-expired-tokens', async () => {
 *       await db.token.deleteMany({ where: { expiresAt: { lt: new Date() } } });
 *     }).daily().at('02:00').build(),
 *
 *     task('send-daily-digest', async () => {
 *       await sendDigest();
 *     }).daily().at('09:00').weekdays().build(),
 *   ],
 *   timezone: 'UTC',
 *   debug: false,
 *   onTaskComplete: (task, ctx, duration) => {
 *     console.log(`Task ${task.name} completed in ${duration}ms`);
 *   },
 * });
 *
 * const scheduler = container.resolve(SCHEDULER_MANAGER);
 * scheduler.start();
 * ```
 */
export function registerSchedulerProviders(
  container: Container,
  config: SchedulerPluginOptions
): void {
  // Register config
  container.register({
    provide: SCHEDULER_CONFIG,
    useValue: config,
  });

  // Extract tasks and options from config
  const { tasks, autoStart: _autoStart, ...options } = config;

  // Create scheduler manager (synchronous operation)
  const schedulerManager = createScheduler(tasks, options);

  // Register the scheduler manager instance
  container.register({
    provide: SCHEDULER_MANAGER,
    useValue: schedulerManager,
  });
}
