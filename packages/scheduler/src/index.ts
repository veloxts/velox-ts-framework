/**
 * @veloxts/scheduler
 *
 * Task scheduling for VeloxTS framework.
 * Laravel-inspired cron-like task scheduling with fluent API.
 *
 * @example
 * ```typescript
 * import { schedulerPlugin, defineTask, defineSchedule } from '@veloxts/scheduler';
 *
 * // Define scheduled tasks with fluent API - .build() is auto-called
 * const schedule = defineSchedule([
 *   defineTask('cleanup-expired-tokens', async () => {
 *     await db.token.deleteMany({
 *       where: { expiresAt: { lt: new Date() } }
 *     });
 *   })
 *     .daily()
 *     .at('02:00')
 *     .timezone('America/New_York')
 *     .withoutOverlapping()
 *     .onSuccess((ctx, duration) => {
 *       console.log(`Cleanup completed in ${duration}ms`);
 *     }),
 *
 *   defineTask('send-daily-digest', async () => {
 *     await sendDailyDigest();
 *   })
 *     .daily()
 *     .at('09:00')
 *     .weekdays(),
 *
 *   defineTask('backup-database', async () => {
 *     await runDatabaseBackup();
 *   })
 *     .weekly()
 *     .sundays()
 *     .at('03:00')
 *     .onSuccess(() => notifySlack('Backup complete'))
 *     .onFailure((ctx, error) => notifyPagerDuty(error)),
 * ]);
 *
 * // Register plugin
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
 *
 * @packageDocumentation
 */

// Manager
export { createScheduler, scheduler } from './manager.js';
// Plugin
export {
  _resetStandaloneScheduler,
  getScheduler,
  getSchedulerFromInstance,
  schedulerPlugin,
} from './plugin.js';
export type { ScheduleInput } from './task.js';
// Task builder
export { defineSchedule, defineTask, schedule, task } from './task.js';
// Types
export type {
  DayOfWeek,
  DayOfWeekNumber,
  ScheduleConstraint,
  ScheduledTask,
  SchedulerManager,
  SchedulerOptions,
  SchedulerPluginOptions,
  TaskBuilder,
  TaskContext,
  TaskExecution,
  TaskFailureCallback,
  TaskHandler,
  TaskSkipCallback,
  TaskSuccessCallback,
} from './types.js';

// ============================================================================
// Dependency Injection
// ============================================================================

/**
 * DI tokens and providers for @veloxts/scheduler
 *
 * Use these to integrate scheduler services with the @veloxts/core DI container.
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerSchedulerProviders, SCHEDULER_MANAGER, defineTask, defineSchedule } from '@veloxts/scheduler';
 *
 * const container = new Container();
 * registerSchedulerProviders(container, {
 *   tasks: defineSchedule([
 *     defineTask('cleanup', () => db.cleanup()).daily(),
 *   ]),
 * });
 *
 * const scheduler = container.resolve(SCHEDULER_MANAGER);
 * scheduler.start();
 * ```
 */

// Provider exports - factory functions for registering services
export { registerSchedulerProviders } from './providers.js';
// Token exports - unique identifiers for DI resolution
export { SCHEDULER_CONFIG, SCHEDULER_MANAGER } from './tokens.js';
