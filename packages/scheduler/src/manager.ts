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
 * Default max lock duration in minutes (24 hours).
 */
const DEFAULT_MAX_LOCK_MINUTES = 1440;

/**
 * Internal job state.
 */
interface JobState {
  task: ScheduledTask;
  cronJob: CronJob;
  isRunning: boolean;
  /** When the current execution started (for lock expiration) */
  runningStartedAt?: Date;
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

  // Execution history - use per-task arrays for O(1) trimming instead of O(n²)
  const historyByTask = new Map<string, TaskExecution[]>();

  // Get combined history (for API compatibility)
  function getAllHistory(): TaskExecution[] {
    const all: TaskExecution[] = [];
    for (const taskHistory of historyByTask.values()) {
      all.push(...taskHistory);
    }
    // Sort by scheduledAt descending (most recent first)
    return all.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  }

  // Running state
  let running = false;

  // Track running task promises for graceful shutdown
  const runningTasks = new Map<string, Promise<TaskExecution>>();

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
   * O(1) amortized - uses per-task arrays with simple shift for trimming.
   */
  function addToHistory(execution: TaskExecution): void {
    let taskHistory = historyByTask.get(execution.taskName);
    if (!taskHistory) {
      taskHistory = [];
      historyByTask.set(execution.taskName, taskHistory);
    }

    taskHistory.push(execution);

    // Trim oldest entries if needed - O(1) with shift
    while (taskHistory.length > MAX_HISTORY_PER_TASK) {
      taskHistory.shift();
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
      // Check if the lock has expired
      const maxLockMs = (task.maxLockMinutes ?? DEFAULT_MAX_LOCK_MINUTES) * 60 * 1000;
      const lockExpired =
        jobState.runningStartedAt && Date.now() - jobState.runningStartedAt.getTime() > maxLockMs;

      if (lockExpired) {
        // Lock expired - force release and allow new execution
        log(
          `Lock expired for ${task.name} after ${task.maxLockMinutes ?? DEFAULT_MAX_LOCK_MINUTES} minutes, forcing new execution`
        );
        jobState.isRunning = false;
        jobState.runningStartedAt = undefined;
      } else {
        // Lock still valid - skip this execution
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
    jobState.runningStartedAt = new Date();

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
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`Task timed out after ${task.timeout}ms`)),
            task.timeout
          );
        });

        try {
          await Promise.race([task.handler(ctx), timeoutPromise]);
        } finally {
          // Clear the timeout timer to prevent memory leak
          if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
          }
        }
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
      jobState.runningStartedAt = undefined;
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
            // Track the running promise for graceful shutdown
            const taskPromise = executeTask(jobState)
              .catch((err) => {
                console.error(`[scheduler] Unhandled error in ${task.name}:`, err);
                // Return a failed execution to satisfy the type
                return {
                  taskName: task.name,
                  scheduledAt: new Date(),
                  startedAt: new Date(),
                  completedAt: new Date(),
                  status: 'failed' as const,
                  error: err instanceof Error ? err.message : String(err),
                };
              })
              .finally(() => {
                runningTasks.delete(task.name);
              });
            runningTasks.set(task.name, taskPromise);
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

      // Stop all cron jobs (prevents new executions)
      for (const jobState of jobs.values()) {
        jobState.cronJob.stop();
      }

      // Wait for running tasks to complete with timeout
      // Uses Promise.race instead of busy-wait polling for efficiency
      const maxWait = 30000; // 30 seconds
      const runningPromises = Array.from(runningTasks.values());

      if (runningPromises.length > 0) {
        log(`Waiting for ${runningPromises.length} running task(s) to complete...`);

        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            log('Graceful shutdown timeout reached, forcing stop');
            resolve();
          }, maxWait);
        });

        // Wait for all tasks OR timeout, whichever comes first
        await Promise.race([Promise.all(runningPromises), timeoutPromise]);
      }

      running = false;
      runningTasks.clear();
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
        // O(1) lookup for specific task
        return [...(historyByTask.get(taskName) ?? [])];
      }
      // Return combined history for all tasks
      return getAllHistory();
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
