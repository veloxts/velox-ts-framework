/**
 * Scheduler Types Tests
 *
 * Type-level tests to ensure types work correctly.
 */

import { describe, expect, it } from 'vitest';

import type {
  DayOfWeek,
  DayOfWeekNumber,
  ScheduledTask,
  SchedulerOptions,
  SchedulerPluginOptions,
  TaskContext,
  TaskExecution,
} from '../types.js';

describe('DayOfWeek Type', () => {
  it('should accept valid day names', () => {
    const days: DayOfWeek[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];

    expect(days).toHaveLength(7);
  });
});

describe('DayOfWeekNumber Type', () => {
  it('should accept valid day numbers', () => {
    const days: DayOfWeekNumber[] = [0, 1, 2, 3, 4, 5, 6];

    expect(days).toHaveLength(7);
    expect(days[0]).toBe(0); // Sunday
    expect(days[6]).toBe(6); // Saturday
  });
});

describe('TaskContext Type', () => {
  it('should have required properties', () => {
    const ctx: TaskContext = {
      name: 'test-task',
      scheduledAt: new Date(),
      startedAt: new Date(),
    };

    expect(ctx.name).toBe('test-task');
    expect(ctx.scheduledAt).toBeInstanceOf(Date);
    expect(ctx.startedAt).toBeInstanceOf(Date);
    expect(ctx.lastRunAt).toBeUndefined();
  });

  it('should support optional lastRunAt', () => {
    const ctx: TaskContext = {
      name: 'test-task',
      scheduledAt: new Date(),
      startedAt: new Date(),
      lastRunAt: new Date(),
    };

    expect(ctx.lastRunAt).toBeInstanceOf(Date);
  });
});

describe('TaskExecution Type', () => {
  it('should represent running execution', () => {
    const execution: TaskExecution = {
      taskName: 'test-task',
      scheduledAt: new Date(),
      startedAt: new Date(),
      status: 'running',
    };

    expect(execution.status).toBe('running');
    expect(execution.completedAt).toBeUndefined();
    expect(execution.duration).toBeUndefined();
  });

  it('should represent completed execution', () => {
    const execution: TaskExecution = {
      taskName: 'test-task',
      scheduledAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 150,
      status: 'completed',
    };

    expect(execution.status).toBe('completed');
    expect(execution.duration).toBe(150);
  });

  it('should represent failed execution', () => {
    const execution: TaskExecution = {
      taskName: 'test-task',
      scheduledAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 50,
      status: 'failed',
      error: 'Something went wrong',
    };

    expect(execution.status).toBe('failed');
    expect(execution.error).toBe('Something went wrong');
  });

  it('should represent skipped execution', () => {
    const execution: TaskExecution = {
      taskName: 'test-task',
      scheduledAt: new Date(),
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 0,
      status: 'skipped',
    };

    expect(execution.status).toBe('skipped');
  });
});

describe('ScheduledTask Type', () => {
  it('should have all required properties', () => {
    const task: ScheduledTask = {
      name: 'cleanup',
      cronExpression: '0 0 * * *',
      timezone: 'UTC',
      handler: async () => {},
      withoutOverlapping: false,
      constraints: [],
      enabled: true,
    };

    expect(task.name).toBe('cleanup');
    expect(task.cronExpression).toBe('0 0 * * *');
    expect(task.timezone).toBe('UTC');
    expect(task.enabled).toBe(true);
  });

  it('should support optional properties', () => {
    const task: ScheduledTask = {
      name: 'full-featured',
      description: 'A fully configured task',
      cronExpression: '0 2 * * *',
      timezone: 'America/New_York',
      handler: async () => {},
      withoutOverlapping: true,
      timeout: 60000,
      onSuccess: async () => {},
      onFailure: async () => {},
      onSkip: async () => {},
      constraints: [() => true],
      enabled: true,
    };

    expect(task.description).toBe('A fully configured task');
    expect(task.timeout).toBe(60000);
    expect(task.onSuccess).toBeDefined();
    expect(task.onFailure).toBeDefined();
    expect(task.onSkip).toBeDefined();
  });
});

describe('SchedulerOptions Type', () => {
  it('should have all optional properties', () => {
    const options: SchedulerOptions = {};

    expect(options.timezone).toBeUndefined();
    expect(options.onTaskStart).toBeUndefined();
    expect(options.debug).toBeUndefined();
  });

  it('should support all callbacks', () => {
    const options: SchedulerOptions = {
      timezone: 'UTC',
      onTaskStart: async () => {},
      onTaskComplete: async () => {},
      onTaskError: async () => {},
      onTaskSkip: async () => {},
      debug: true,
    };

    expect(options.timezone).toBe('UTC');
    expect(options.debug).toBe(true);
  });
});

describe('SchedulerPluginOptions Type', () => {
  it('should require tasks array', () => {
    const options: SchedulerPluginOptions = {
      tasks: [],
    };

    expect(options.tasks).toEqual([]);
  });

  it('should support autoStart option', () => {
    const options: SchedulerPluginOptions = {
      tasks: [],
      autoStart: false,
    };

    expect(options.autoStart).toBe(false);
  });

  it('should extend SchedulerOptions', () => {
    const options: SchedulerPluginOptions = {
      tasks: [],
      timezone: 'Europe/London',
      debug: true,
      autoStart: true,
    };

    expect(options.timezone).toBe('Europe/London');
    expect(options.debug).toBe(true);
  });
});
