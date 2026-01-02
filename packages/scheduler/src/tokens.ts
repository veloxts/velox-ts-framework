/**
 * DI Tokens for @veloxts/scheduler
 *
 * Symbol-based tokens for type-safe dependency injection.
 * These tokens allow scheduler services to be registered, resolved, and mocked via the DI container.
 *
 * @module scheduler/tokens
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { SCHEDULER_MANAGER, registerSchedulerProviders, task } from '@veloxts/scheduler';
 *
 * const container = new Container();
 * registerSchedulerProviders(container, {
 *   tasks: [
 *     task('cleanup', () => db.cleanup()).daily().build(),
 *   ],
 * });
 *
 * const scheduler = container.resolve(SCHEDULER_MANAGER);
 * scheduler.start();
 * ```
 */

import { token } from '@veloxts/core';

import type { SchedulerManager, SchedulerPluginOptions } from './types.js';

// ============================================================================
// Core Scheduler Tokens
// ============================================================================

/**
 * Scheduler manager token
 *
 * The main scheduler manager instance for scheduling and managing tasks.
 *
 * @example
 * ```typescript
 * const scheduler = container.resolve(SCHEDULER_MANAGER);
 * scheduler.start();
 * const tasks = scheduler.getTasks();
 * await scheduler.runTask('cleanup');
 * ```
 */
export const SCHEDULER_MANAGER = token.symbol<SchedulerManager>('SCHEDULER_MANAGER');

// ============================================================================
// Configuration Tokens
// ============================================================================

/**
 * Scheduler configuration token
 *
 * Contains scheduler plugin options including tasks, timezone, and callbacks.
 *
 * @example
 * ```typescript
 * const config = container.resolve(SCHEDULER_CONFIG);
 * console.log(config.timezone); // 'UTC'
 * console.log(config.tasks.length); // 3
 * ```
 */
export const SCHEDULER_CONFIG = token.symbol<SchedulerPluginOptions>('SCHEDULER_CONFIG');
