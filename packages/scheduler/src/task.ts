/**
 * Task Builder
 *
 * Fluent API for defining scheduled tasks with Laravel-style elegance.
 */

import type {
  DayOfWeek,
  DayOfWeekNumber,
  ScheduleConstraint,
  ScheduledTask,
  TaskBuilder,
  TaskContext,
  TaskFailureCallback,
  TaskHandler,
  TaskSkipCallback,
  TaskSuccessCallback,
} from './types.js';

/**
 * Map day names to cron day numbers.
 */
const DAY_MAP: Record<DayOfWeek, DayOfWeekNumber> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Convert day to numeric value.
 */
function dayToNumber(day: DayOfWeek | DayOfWeekNumber): DayOfWeekNumber {
  if (typeof day === 'number') return day;
  return DAY_MAP[day];
}

/**
 * Parse time string (HH:MM) to hours and minutes.
 */
function parseTime(time: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = time.split(':');
  const hour = Number.parseInt(hourStr, 10);
  const minute = minuteStr ? Number.parseInt(minuteStr, 10) : 0;

  if (Number.isNaN(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid hour in time "${time}". Must be 0-23.`);
  }
  if (Number.isNaN(minute) || minute < 0 || minute > 59) {
    throw new Error(`Invalid minute in time "${time}". Must be 0-59.`);
  }

  return { hour, minute };
}

/**
 * Task builder implementation.
 */
class TaskBuilderImpl implements TaskBuilder {
  private _name: string;
  private _description?: string;
  private _handler: TaskHandler;
  private _timezone = 'UTC';

  // Cron expression parts: minute hour day month dayOfWeek
  private _minute = '*';
  private _hour = '*';
  private _dayOfMonth = '*';
  private _month = '*';
  private _dayOfWeek = '*';

  private _withoutOverlapping = false;
  private _maxLockMinutes?: number;
  private _timeout?: number;
  private _onSuccess?: TaskSuccessCallback;
  private _onFailure?: TaskFailureCallback;
  private _onSkip?: TaskSkipCallback;
  private _constraints: ScheduleConstraint[] = [];
  private _enabled = true;

  // Day constraints (applied as runtime constraints, not cron)
  private _dayConstraints: DayOfWeekNumber[] | null = null;

  // Time constraints
  private _betweenStart?: string;
  private _betweenEnd?: string;
  private _unlessBetweenStart?: string;
  private _unlessBetweenEnd?: string;

  constructor(name: string, handler: TaskHandler) {
    this._name = name;
    this._handler = handler;
  }

  description(text: string): TaskBuilder {
    this._description = text;
    return this;
  }

  // ===========================================================================
  // Schedule Frequency
  // ===========================================================================

  everyMinute(): TaskBuilder {
    this._minute = '*';
    this._hour = '*';
    return this;
  }

  everyMinutes(n: number): TaskBuilder {
    if (n < 1 || n > 59) {
      throw new Error('Minutes must be between 1 and 59');
    }
    this._minute = `*/${n}`;
    this._hour = '*';
    return this;
  }

  everyFiveMinutes(): TaskBuilder {
    return this.everyMinutes(5);
  }

  everyTenMinutes(): TaskBuilder {
    return this.everyMinutes(10);
  }

  everyFifteenMinutes(): TaskBuilder {
    return this.everyMinutes(15);
  }

  everyThirtyMinutes(): TaskBuilder {
    return this.everyMinutes(30);
  }

  hourly(): TaskBuilder {
    this._minute = '0';
    this._hour = '*';
    return this;
  }

  hourlyAt(minute: number): TaskBuilder {
    if (minute < 0 || minute > 59) {
      throw new Error('Minute must be between 0 and 59');
    }
    this._minute = String(minute);
    this._hour = '*';
    return this;
  }

  everyHours(n: number): TaskBuilder {
    if (n < 1 || n > 23) {
      throw new Error('Hours must be between 1 and 23');
    }
    this._minute = '0';
    this._hour = `*/${n}`;
    return this;
  }

  daily(): TaskBuilder {
    this._minute = '0';
    this._hour = '0';
    return this;
  }

  dailyAt(time: string): TaskBuilder {
    const { hour, minute } = parseTime(time);
    this._minute = String(minute);
    this._hour = String(hour);
    return this;
  }

  twiceDaily(hour1: number, hour2: number): TaskBuilder {
    if (hour1 < 0 || hour1 > 23 || hour2 < 0 || hour2 > 23) {
      throw new Error('Hours must be between 0 and 23');
    }
    this._minute = '0';
    this._hour = `${hour1},${hour2}`;
    return this;
  }

  weekly(): TaskBuilder {
    this._minute = '0';
    this._hour = '0';
    this._dayOfWeek = '0'; // Sunday
    return this;
  }

  weeklyOn(day: DayOfWeek | DayOfWeekNumber, time?: string): TaskBuilder {
    const dayNum = dayToNumber(day);
    this._dayOfWeek = String(dayNum);

    if (time) {
      const { hour, minute } = parseTime(time);
      this._minute = String(minute);
      this._hour = String(hour);
    } else {
      this._minute = '0';
      this._hour = '0';
    }

    return this;
  }

  monthly(): TaskBuilder {
    this._minute = '0';
    this._hour = '0';
    this._dayOfMonth = '1';
    return this;
  }

  monthlyOn(day: number, time?: string): TaskBuilder {
    if (day < 1 || day > 31) {
      throw new Error('Day must be between 1 and 31');
    }
    this._dayOfMonth = String(day);

    if (time) {
      const { hour, minute } = parseTime(time);
      this._minute = String(minute);
      this._hour = String(hour);
    } else {
      this._minute = '0';
      this._hour = '0';
    }

    return this;
  }

  quarterly(): TaskBuilder {
    this._minute = '0';
    this._hour = '0';
    this._dayOfMonth = '1';
    this._month = '1,4,7,10'; // Jan, Apr, Jul, Oct
    return this;
  }

  yearly(): TaskBuilder {
    this._minute = '0';
    this._hour = '0';
    this._dayOfMonth = '1';
    this._month = '1'; // January
    return this;
  }

  cron(expression: string): TaskBuilder {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new Error(
        `Invalid cron expression "${expression}". Expected 5 parts (minute hour day month dayOfWeek).`
      );
    }
    [this._minute, this._hour, this._dayOfMonth, this._month, this._dayOfWeek] = parts;
    return this;
  }

  // ===========================================================================
  // Day Constraints
  // ===========================================================================

  weekdays(): TaskBuilder {
    this._dayConstraints = [1, 2, 3, 4, 5]; // Mon-Fri
    return this;
  }

  weekends(): TaskBuilder {
    this._dayConstraints = [0, 6]; // Sun, Sat
    return this;
  }

  sundays(): TaskBuilder {
    this._dayConstraints = [0];
    return this;
  }

  mondays(): TaskBuilder {
    this._dayConstraints = [1];
    return this;
  }

  tuesdays(): TaskBuilder {
    this._dayConstraints = [2];
    return this;
  }

  wednesdays(): TaskBuilder {
    this._dayConstraints = [3];
    return this;
  }

  thursdays(): TaskBuilder {
    this._dayConstraints = [4];
    return this;
  }

  fridays(): TaskBuilder {
    this._dayConstraints = [5];
    return this;
  }

  saturdays(): TaskBuilder {
    this._dayConstraints = [6];
    return this;
  }

  days(days: (DayOfWeek | DayOfWeekNumber)[]): TaskBuilder {
    this._dayConstraints = days.map(dayToNumber);
    return this;
  }

  // ===========================================================================
  // Time Constraints
  // ===========================================================================

  at(time: string): TaskBuilder {
    const { hour, minute } = parseTime(time);
    this._minute = String(minute);
    this._hour = String(hour);
    return this;
  }

  between(start: string, end: string): TaskBuilder {
    // Validate times
    parseTime(start);
    parseTime(end);
    this._betweenStart = start;
    this._betweenEnd = end;
    return this;
  }

  unlessBetween(start: string, end: string): TaskBuilder {
    // Validate times
    parseTime(start);
    parseTime(end);
    this._unlessBetweenStart = start;
    this._unlessBetweenEnd = end;
    return this;
  }

  // ===========================================================================
  // Timezone
  // ===========================================================================

  timezone(tz: string): TaskBuilder {
    this._timezone = tz;
    return this;
  }

  // ===========================================================================
  // Execution Control
  // ===========================================================================

  withoutOverlapping(maxLockMinutes?: number): TaskBuilder {
    this._withoutOverlapping = true;
    this._maxLockMinutes = maxLockMinutes;
    return this;
  }

  timeout(ms: number): TaskBuilder {
    if (ms < 0) {
      throw new Error('Timeout must be a positive number');
    }
    this._timeout = ms;
    return this;
  }

  when(constraint: ScheduleConstraint): TaskBuilder {
    this._constraints.push(constraint);
    return this;
  }

  skip(constraint: ScheduleConstraint): TaskBuilder {
    // Invert the constraint
    this._constraints.push(async (ctx) => !(await constraint(ctx)));
    return this;
  }

  environments(envs: string[]): TaskBuilder {
    const currentEnv = process.env.NODE_ENV ?? 'development';
    this._constraints.push(() => envs.includes(currentEnv));
    return this;
  }

  evenInMaintenanceMode(): TaskBuilder {
    // This is a placeholder - maintenance mode would be checked by a constraint
    // For now, it's a no-op
    return this;
  }

  // ===========================================================================
  // Callbacks
  // ===========================================================================

  onSuccess(callback: TaskSuccessCallback): TaskBuilder {
    this._onSuccess = callback;
    return this;
  }

  onFailure(callback: TaskFailureCallback): TaskBuilder {
    this._onFailure = callback;
    return this;
  }

  onSkip(callback: TaskSkipCallback): TaskBuilder {
    this._onSkip = callback;
    return this;
  }

  // ===========================================================================
  // Build
  // ===========================================================================

  build(): ScheduledTask {
    // Add day constraints if specified
    if (this._dayConstraints !== null) {
      const allowedDays = this._dayConstraints;
      this._constraints.push((ctx: TaskContext) => {
        const day = ctx.scheduledAt.getDay() as DayOfWeekNumber;
        return allowedDays.includes(day);
      });
    }

    // Add between time constraint
    if (this._betweenStart && this._betweenEnd) {
      const start = parseTime(this._betweenStart);
      const end = parseTime(this._betweenEnd);
      this._constraints.push((ctx: TaskContext) => {
        const hours = ctx.scheduledAt.getHours();
        const minutes = ctx.scheduledAt.getMinutes();
        const currentMinutes = hours * 60 + minutes;
        const startMinutes = start.hour * 60 + start.minute;
        const endMinutes = end.hour * 60 + end.minute;
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      });
    }

    // Add unless between time constraint
    if (this._unlessBetweenStart && this._unlessBetweenEnd) {
      const start = parseTime(this._unlessBetweenStart);
      const end = parseTime(this._unlessBetweenEnd);
      this._constraints.push((ctx: TaskContext) => {
        const hours = ctx.scheduledAt.getHours();
        const minutes = ctx.scheduledAt.getMinutes();
        const currentMinutes = hours * 60 + minutes;
        const startMinutes = start.hour * 60 + start.minute;
        const endMinutes = end.hour * 60 + end.minute;
        return currentMinutes < startMinutes || currentMinutes > endMinutes;
      });
    }

    const cronExpression = `${this._minute} ${this._hour} ${this._dayOfMonth} ${this._month} ${this._dayOfWeek}`;

    return {
      name: this._name,
      description: this._description,
      cronExpression,
      timezone: this._timezone,
      handler: this._handler,
      withoutOverlapping: this._withoutOverlapping,
      maxLockMinutes: this._maxLockMinutes,
      timeout: this._timeout,
      onSuccess: this._onSuccess,
      onFailure: this._onFailure,
      onSkip: this._onSkip,
      constraints: this._constraints,
      enabled: this._enabled,
    };
  }
}

/**
 * Create a new task builder.
 *
 * @param name - Unique task name
 * @param handler - Task handler function
 * @returns Task builder for fluent configuration
 *
 * @example
 * ```typescript
 * const cleanupTask = task('cleanup-expired-tokens', async () => {
 *   await db.token.deleteMany({
 *     where: { expiresAt: { lt: new Date() } }
 *   });
 * })
 *   .daily()
 *   .at('02:00')
 *   .timezone('America/New_York')
 *   .withoutOverlapping()
 *   .onSuccess((ctx, duration) => {
 *     console.log(`Cleanup completed in ${duration}ms`);
 *   })
 *   .build();
 * ```
 */
export function task(name: string, handler: TaskHandler): TaskBuilder {
  return new TaskBuilderImpl(name, handler);
}

/**
 * Alias for task() - provides consistency with defineJob() and defineMail().
 *
 * @example
 * ```typescript
 * import { defineTask, defineSchedule } from '@veloxts/scheduler';
 *
 * const cleanup = defineTask('cleanup-expired-tokens', async () => {
 *   await db.token.deleteMany({
 *     where: { expiresAt: { lt: new Date() } }
 *   });
 * })
 *   .daily()
 *   .at('02:00')
 *   .build();
 * ```
 */
export const defineTask = task;

/**
 * Input type for defineSchedule - accepts either built tasks or builders.
 */
export type ScheduleInput = ScheduledTask | TaskBuilder;

/**
 * Type guard to check if value is a TaskBuilder (has build method).
 */
function isTaskBuilder(value: ScheduleInput): value is TaskBuilder {
  return (
    value !== null &&
    typeof value === 'object' &&
    'build' in value &&
    typeof value.build === 'function'
  );
}

/**
 * Define a schedule with multiple tasks.
 *
 * Auto-calls `.build()` on TaskBuilder instances, allowing either:
 * - Pre-built ScheduledTask objects
 * - TaskBuilder instances (build() called automatically)
 *
 * @param tasks - Array of scheduled tasks or task builders
 * @returns Array of scheduled tasks
 *
 * @example
 * ```typescript
 * // .build() is now optional - defineSchedule calls it automatically
 * export const schedule = defineSchedule([
 *   defineTask('cleanup', () => db.cleanup()).daily().at('02:00'),
 *   defineTask('digest', () => sendDigest()).daily().at('09:00'),
 *   defineTask('backup', () => runBackup()).weekly().sundays().at('03:00'),
 * ]);
 *
 * // Explicit .build() still works for backward compatibility
 * export const schedule = defineSchedule([
 *   defineTask('cleanup', () => db.cleanup()).daily().at('02:00').build(),
 * ]);
 * ```
 */
export function defineSchedule(tasks: ScheduleInput[]): ScheduledTask[] {
  // Normalize: call build() on TaskBuilders, pass through ScheduledTasks
  const builtTasks = tasks.map((t) => (isTaskBuilder(t) ? t.build() : t));

  // Validate unique names
  const names = new Set<string>();
  for (const t of builtTasks) {
    if (names.has(t.name)) {
      throw new Error(`Duplicate task name: "${t.name}". Task names must be unique.`);
    }
    names.add(t.name);
  }

  return builtTasks;
}

/**
 * Alias for defineSchedule() - matches pattern of job/mail/task short aliases.
 *
 * @example
 * ```typescript
 * import { schedule, task } from '@veloxts/scheduler';
 *
 * const tasks = schedule([
 *   task('cleanup', () => db.cleanup()).daily().at('02:00'),
 *   task('digest', () => sendDigest()).daily().at('09:00'),
 * ]);
 * ```
 */
export const schedule = defineSchedule;
