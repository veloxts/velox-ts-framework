/**
 * Scheduler Types
 *
 * Type definitions for the VeloxTS task scheduling system.
 * Inspired by Laravel's elegant scheduling API.
 */

/**
 * Days of the week for scheduling.
 */
export type DayOfWeek =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

/**
 * Numeric day of week (0-6, Sunday = 0).
 */
export type DayOfWeekNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Task execution context provided to handlers.
 */
export interface TaskContext {
  /** Task name */
  name: string;
  /** Scheduled time for this execution */
  scheduledAt: Date;
  /** Actual execution start time */
  startedAt: Date;
  /** Previous execution time (if any) */
  lastRunAt?: Date;
}

/**
 * Task handler function.
 */
export type TaskHandler = (ctx: TaskContext) => void | Promise<void>;

/**
 * Task success callback.
 */
export type TaskSuccessCallback = (ctx: TaskContext, duration: number) => void | Promise<void>;

/**
 * Task failure callback.
 */
export type TaskFailureCallback = (
  ctx: TaskContext,
  error: Error,
  duration: number
) => void | Promise<void>;

/**
 * Task skip callback (when overlapping is prevented).
 */
export type TaskSkipCallback = (ctx: TaskContext, reason: string) => void | Promise<void>;

/**
 * Schedule constraint for conditional execution.
 */
export type ScheduleConstraint = (ctx: TaskContext) => boolean | Promise<boolean>;

/**
 * Configured task ready for scheduling.
 */
export interface ScheduledTask {
  /** Unique task name */
  name: string;
  /** Task description */
  description?: string;
  /** Cron expression */
  cronExpression: string;
  /** Timezone for schedule interpretation */
  timezone: string;
  /** Task handler function */
  handler: TaskHandler;
  /** Prevent overlapping executions */
  withoutOverlapping: boolean;
  /** Maximum execution time in milliseconds */
  timeout?: number;
  /** Callbacks */
  onSuccess?: TaskSuccessCallback;
  onFailure?: TaskFailureCallback;
  onSkip?: TaskSkipCallback;
  /** Execution constraints */
  constraints: ScheduleConstraint[];
  /** Whether task is enabled */
  enabled: boolean;
}

/**
 * Task execution record.
 */
export interface TaskExecution {
  /** Task name */
  taskName: string;
  /** Scheduled time */
  scheduledAt: Date;
  /** Actual start time */
  startedAt: Date;
  /** Completion time (if completed) */
  completedAt?: Date;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Execution status */
  status: 'running' | 'completed' | 'failed' | 'skipped';
  /** Error message (if failed) */
  error?: string;
}

/**
 * Scheduler configuration options.
 */
export interface SchedulerOptions {
  /** Timezone for all tasks (default: 'UTC') */
  timezone?: string;
  /** Callback when a task starts */
  onTaskStart?: (task: ScheduledTask, ctx: TaskContext) => void | Promise<void>;
  /** Callback when a task completes */
  onTaskComplete?: (
    task: ScheduledTask,
    ctx: TaskContext,
    duration: number
  ) => void | Promise<void>;
  /** Callback when a task fails */
  onTaskError?: (
    task: ScheduledTask,
    ctx: TaskContext,
    error: Error,
    duration: number
  ) => void | Promise<void>;
  /** Callback when a task is skipped */
  onTaskSkip?: (task: ScheduledTask, ctx: TaskContext, reason: string) => void | Promise<void>;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Scheduler plugin options.
 */
export interface SchedulerPluginOptions extends SchedulerOptions {
  /** Array of scheduled tasks */
  tasks: ScheduledTask[];
  /** Auto-start scheduler on plugin registration (default: true in production) */
  autoStart?: boolean;
}

/**
 * Scheduler manager interface.
 */
export interface SchedulerManager {
  /** Start the scheduler */
  start(): void;
  /** Stop the scheduler */
  stop(): Promise<void>;
  /** Check if scheduler is running */
  isRunning(): boolean;
  /** Get all scheduled tasks */
  getTasks(): ScheduledTask[];
  /** Get a task by name */
  getTask(name: string): ScheduledTask | undefined;
  /** Get task execution history */
  getHistory(taskName?: string): TaskExecution[];
  /** Run a specific task immediately */
  runTask(name: string): Promise<TaskExecution>;
  /** Get next scheduled run time for a task */
  getNextRun(name: string): Date | undefined;
  /** Check if a task is currently running */
  isTaskRunning(name: string): boolean;
}

/**
 * Task builder interface for fluent API.
 */
export interface TaskBuilder {
  /** Set task description */
  description(text: string): TaskBuilder;

  // =========================================================================
  // Schedule Frequency
  // =========================================================================

  /** Run every minute */
  everyMinute(): TaskBuilder;
  /** Run every N minutes */
  everyMinutes(n: number): TaskBuilder;
  /** Run every 5 minutes */
  everyFiveMinutes(): TaskBuilder;
  /** Run every 10 minutes */
  everyTenMinutes(): TaskBuilder;
  /** Run every 15 minutes */
  everyFifteenMinutes(): TaskBuilder;
  /** Run every 30 minutes */
  everyThirtyMinutes(): TaskBuilder;
  /** Run every hour */
  hourly(): TaskBuilder;
  /** Run every hour at specific minute */
  hourlyAt(minute: number): TaskBuilder;
  /** Run every N hours */
  everyHours(n: number): TaskBuilder;
  /** Run daily at midnight */
  daily(): TaskBuilder;
  /** Run daily at specific time (HH:MM) */
  dailyAt(time: string): TaskBuilder;
  /** Run twice daily at specific hours */
  twiceDaily(hour1: number, hour2: number): TaskBuilder;
  /** Run weekly on Sunday at midnight */
  weekly(): TaskBuilder;
  /** Run weekly on specific day */
  weeklyOn(day: DayOfWeek | DayOfWeekNumber, time?: string): TaskBuilder;
  /** Run monthly on the 1st at midnight */
  monthly(): TaskBuilder;
  /** Run monthly on specific day */
  monthlyOn(day: number, time?: string): TaskBuilder;
  /** Run quarterly (Jan 1, Apr 1, Jul 1, Oct 1) */
  quarterly(): TaskBuilder;
  /** Run yearly on Jan 1st */
  yearly(): TaskBuilder;
  /** Use custom cron expression */
  cron(expression: string): TaskBuilder;

  // =========================================================================
  // Day Constraints
  // =========================================================================

  /** Run only on weekdays (Mon-Fri) */
  weekdays(): TaskBuilder;
  /** Run only on weekends (Sat-Sun) */
  weekends(): TaskBuilder;
  /** Run only on Sundays */
  sundays(): TaskBuilder;
  /** Run only on Mondays */
  mondays(): TaskBuilder;
  /** Run only on Tuesdays */
  tuesdays(): TaskBuilder;
  /** Run only on Wednesdays */
  wednesdays(): TaskBuilder;
  /** Run only on Thursdays */
  thursdays(): TaskBuilder;
  /** Run only on Fridays */
  fridays(): TaskBuilder;
  /** Run only on Saturdays */
  saturdays(): TaskBuilder;
  /** Run only on specific days */
  days(days: (DayOfWeek | DayOfWeekNumber)[]): TaskBuilder;

  // =========================================================================
  // Time Constraints
  // =========================================================================

  /** Set execution time (HH:MM format) */
  at(time: string): TaskBuilder;
  /** Run only between specific hours */
  between(start: string, end: string): TaskBuilder;
  /** Skip execution between specific hours */
  unlessBetween(start: string, end: string): TaskBuilder;

  // =========================================================================
  // Timezone
  // =========================================================================

  /** Set timezone for this task */
  timezone(tz: string): TaskBuilder;

  // =========================================================================
  // Execution Control
  // =========================================================================

  /** Prevent overlapping executions */
  withoutOverlapping(maxLockMinutes?: number): TaskBuilder;
  /** Set maximum execution timeout */
  timeout(ms: number): TaskBuilder;
  /** Run only when constraint returns true */
  when(constraint: ScheduleConstraint): TaskBuilder;
  /** Skip when constraint returns true */
  skip(constraint: ScheduleConstraint): TaskBuilder;
  /** Run only in specific environments */
  environments(envs: string[]): TaskBuilder;
  /** Run even in maintenance mode */
  evenInMaintenanceMode(): TaskBuilder;

  // =========================================================================
  // Callbacks
  // =========================================================================

  /** Callback on successful execution */
  onSuccess(callback: TaskSuccessCallback): TaskBuilder;
  /** Callback on failed execution */
  onFailure(callback: TaskFailureCallback): TaskBuilder;
  /** Callback when task is skipped */
  onSkip(callback: TaskSkipCallback): TaskBuilder;

  // =========================================================================
  // Build
  // =========================================================================

  /** Build the scheduled task configuration */
  build(): ScheduledTask;
}
