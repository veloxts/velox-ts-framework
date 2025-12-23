/**
 * Scheduler Manager
 *
 * Core scheduler that manages and executes scheduled tasks.
 */

import { CronJob } from 'cron';

import type {
  ScheduledTask,
  SchedulerManager,
  SchedulerOptions,
  TaskContext,
  TaskExecution,
} from './types.js';

/**
 * Maximum execution history entries per task.
 */
const MAX_HISTORY_PER_TASK = 100;

/**
 * Internal job state.
 */
interface JobState {
  task: ScheduledTask;
  cronJob: CronJob;
  isRunning: boolean;
  lastRunAt?: Date;
}

/**
 * Create a scheduler manager.
 *
 * @param tasks - Array of scheduled tasks
 * @param options - Scheduler options
 * @returns Scheduler manager instance
 *
 * @example
 * ```typescript
 * import { createScheduler, task } from '@veloxts/scheduler';
 *
 * const scheduler = createScheduler([
 *   task('cleanup', () => db.cleanup()).daily().at('02:00').build(),
 *   task('digest', () => sendDigest()).daily().at('09:00').build(),
 * ], {
 *   timezone: 'America/New_York',
 *   onTaskStart: (task) => console.log(`Starting: ${task.name}`),
 *   onTaskComplete: (task, ctx, duration) => {
 *     console.log(`Completed: ${task.name} in ${duration}ms`);
 *   },
 * });
 *
 * scheduler.start();
 * ```
 */
export function createScheduler(
  tasks: ScheduledTask[],
  options: SchedulerOptions = {}
): SchedulerManager {
  const { timezone: defaultTimezone = 'UTC', debug = false } = options;

  // Job states
  const jobs = new Map<string, JobState>();

  // Execution history
  const history: TaskExecution[] = [];

  // Running state
  let running = false;

  /**
   * Log debug message.
   */
  function log(message: string): void {
    if (debug) {
      console.log(`[scheduler] ${message}`);
    }
  }

  /**
   * Add execution to history.
   */
  function addToHistory(execution: TaskExecution): void {
    history.push(execution);

    // Trim history per task if needed
    const taskHistory = history.filter((e) => e.taskName === execution.taskName);
    if (taskHistory.length > MAX_HISTORY_PER_TASK) {
      const toRemove = taskHistory.length - MAX_HISTORY_PER_TASK;
      let removed = 0;
      for (let i = 0; i < history.length && removed < toRemove; i++) {
        if (history[i].taskName === execution.taskName) {
          history.splice(i, 1);
          removed++;
          i--; // Adjust index after splice
        }
      }
    }
  }

  /**
   * Execute a task.
   */
  async function executeTask(jobState: JobState): Promise<TaskExecution> {
    const { task } = jobState;
    const scheduledAt = new Date();
    const startedAt = new Date();

    const ctx: TaskContext = {
      name: task.name,
      scheduledAt,
      startedAt,
      lastRunAt: jobState.lastRunAt,
    };

    // Create execution record
    const execution: TaskExecution = {
      taskName: task.name,
      scheduledAt,
      startedAt,
      status: 'running',
    };

    // Check if task is already running (overlap prevention)
    if (task.withoutOverlapping && jobState.isRunning) {
      const skipReason = 'Task is still running from previous execution';
      execution.status = 'skipped';
      execution.completedAt = new Date();
      execution.duration = 0;

      log(`Skipping ${task.name}: ${skipReason}`);

      if (task.onSkip) {
        try {
          await task.onSkip(ctx, skipReason);
        } catch {
          // Ignore skip callback errors
        }
      }

      if (options.onTaskSkip) {
        try {
          await options.onTaskSkip(task, ctx, skipReason);
        } catch {
          // Ignore callback errors
        }
      }

      addToHistory(execution);
      return execution;
    }

    // Check constraints
    for (const constraint of task.constraints) {
      try {
        const shouldRun = await constraint(ctx);
        if (!shouldRun) {
          const skipReason = 'Constraint not satisfied';
          execution.status = 'skipped';
          execution.completedAt = new Date();
          execution.duration = 0;

          log(`Skipping ${task.name}: ${skipReason}`);

          if (task.onSkip) {
            try {
              await task.onSkip(ctx, skipReason);
            } catch {
              // Ignore skip callback errors
            }
          }

          if (options.onTaskSkip) {
            try {
              await options.onTaskSkip(task, ctx, skipReason);
            } catch {
              // Ignore callback errors
            }
          }

          addToHistory(execution);
          return execution;
        }
      } catch (error) {
        const skipReason = `Constraint error: ${error instanceof Error ? error.message : String(error)}`;
        execution.status = 'skipped';
        execution.completedAt = new Date();
        execution.duration = 0;

        log(`Skipping ${task.name}: ${skipReason}`);

        addToHistory(execution);
        return execution;
      }
    }

    // Mark as running
    jobState.isRunning = true;

    log(`Starting ${task.name}`);

    if (options.onTaskStart) {
      try {
        await options.onTaskStart(task, ctx);
      } catch {
        // Ignore callback errors
      }
    }

    try {
      // Create timeout promise if specified
      if (task.timeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Task timed out after ${task.timeout}ms`)),
            task.timeout
          );
        });

        await Promise.race([task.handler(ctx), timeoutPromise]);
      } else {
        await task.handler(ctx);
      }

      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();

      execution.status = 'completed';
      execution.completedAt = completedAt;
      execution.duration = duration;

      jobState.lastRunAt = completedAt;

      log(`Completed ${task.name} in ${duration}ms`);

      if (task.onSuccess) {
        try {
          await task.onSuccess(ctx, duration);
        } catch {
          // Ignore success callback errors
        }
      }

      if (options.onTaskComplete) {
        try {
          await options.onTaskComplete(task, ctx, duration);
        } catch {
          // Ignore callback errors
        }
      }
    } catch (error) {
      const completedAt = new Date();
      const duration = completedAt.getTime() - startedAt.getTime();
      const errorObj = error instanceof Error ? error : new Error(String(error));

      execution.status = 'failed';
      execution.completedAt = completedAt;
      execution.duration = duration;
      execution.error = errorObj.message;

      log(`Failed ${task.name}: ${errorObj.message}`);

      if (task.onFailure) {
        try {
          await task.onFailure(ctx, errorObj, duration);
        } catch {
          // Ignore failure callback errors
        }
      }

      if (options.onTaskError) {
        try {
          await options.onTaskError(task, ctx, errorObj, duration);
        } catch {
          // Ignore callback errors
        }
      }
    } finally {
      jobState.isRunning = false;
    }

    addToHistory(execution);
    return execution;
  }

  /**
   * Initialize jobs from tasks.
   */
  function initializeJobs(): void {
    for (const task of tasks) {
      if (!task.enabled) {
        log(`Skipping disabled task: ${task.name}`);
        continue;
      }

      const taskTimezone = task.timezone || defaultTimezone;

      const cronJob = new CronJob(
        task.cronExpression,
        () => {
          const jobState = jobs.get(task.name);
          if (jobState) {
            executeTask(jobState).catch((err) => {
              console.error(`[scheduler] Unhandled error in ${task.name}:`, err);
            });
          }
        },
        null, // onComplete
        false, // start
        taskTimezone
      );

      const jobState: JobState = {
        task,
        cronJob,
        isRunning: false,
      };

      jobs.set(task.name, jobState);
      log(`Registered task: ${task.name} (${task.cronExpression})`);
    }
  }

  // Initialize jobs
  initializeJobs();

  const manager: SchedulerManager = {
    start(): void {
      if (running) {
        log('Scheduler already running');
        return;
      }

      running = true;
      log('Starting scheduler');

      for (const jobState of jobs.values()) {
        jobState.cronJob.start();
      }
    },

    async stop(): Promise<void> {
      if (!running) {
        log('Scheduler not running');
        return;
      }

      log('Stopping scheduler');

      // Stop all cron jobs
      for (const jobState of jobs.values()) {
        jobState.cronJob.stop();
      }

      // Wait for running tasks to complete (with timeout)
      const maxWait = 30000; // 30 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        const stillRunning = Array.from(jobs.values()).some((j) => j.isRunning);
        if (!stillRunning) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      running = false;
      log('Scheduler stopped');
    },

    isRunning(): boolean {
      return running;
    },

    getTasks(): ScheduledTask[] {
      return Array.from(jobs.values()).map((j) => j.task);
    },

    getTask(name: string): ScheduledTask | undefined {
      return jobs.get(name)?.task;
    },

    getHistory(taskName?: string): TaskExecution[] {
      if (taskName) {
        return history.filter((e) => e.taskName === taskName);
      }
      return [...history];
    },

    async runTask(name: string): Promise<TaskExecution> {
      const jobState = jobs.get(name);
      if (!jobState) {
        throw new Error(`Task not found: ${name}`);
      }

      log(`Manually running task: ${name}`);
      return executeTask(jobState);
    },

    getNextRun(name: string): Date | undefined {
      const jobState = jobs.get(name);
      if (!jobState) return undefined;

      try {
        return jobState.cronJob.nextDate().toJSDate();
      } catch {
        return undefined;
      }
    },

    isTaskRunning(name: string): boolean {
      return jobs.get(name)?.isRunning ?? false;
    },
  };

  return manager;
}

/**
 * Alias for createScheduler.
 */
export const scheduler = createScheduler;
