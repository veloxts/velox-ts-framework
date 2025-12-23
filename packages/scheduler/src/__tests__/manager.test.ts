/**
 * Scheduler Manager Tests
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createScheduler } from '../manager.js';
import { task } from '../task.js';
import type { ScheduledTask } from '../types.js';

describe('Scheduler Manager', () => {
  let scheduler: ReturnType<typeof createScheduler>;

  afterEach(async () => {
    if (scheduler) {
      await scheduler.stop();
    }
  });

  describe('createScheduler()', () => {
    it('should create a scheduler with tasks', () => {
      const tasks = [
        task('test', () => {})
          .everyMinute()
          .build(),
      ];

      scheduler = createScheduler(tasks);

      expect(scheduler.getTasks()).toHaveLength(1);
      expect(scheduler.getTask('test')).toBeDefined();
    });

    it('should not include disabled tasks', () => {
      const t: ScheduledTask = {
        ...task('disabled', () => {})
          .everyMinute()
          .build(),
        enabled: false,
      };

      scheduler = createScheduler([t]);

      expect(scheduler.getTasks()).toHaveLength(0);
    });
  });

  describe('start() / stop()', () => {
    it('should start and stop the scheduler', async () => {
      scheduler = createScheduler([
        task('test', () => {})
          .everyMinute()
          .build(),
      ]);

      expect(scheduler.isRunning()).toBe(false);

      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      await scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should not start twice', () => {
      scheduler = createScheduler([
        task('test', () => {})
          .everyMinute()
          .build(),
      ]);

      scheduler.start();
      scheduler.start(); // Should be a no-op

      expect(scheduler.isRunning()).toBe(true);
    });

    it('should handle stop when not running', async () => {
      scheduler = createScheduler([
        task('test', () => {})
          .everyMinute()
          .build(),
      ]);

      await scheduler.stop(); // Should be a no-op
      expect(scheduler.isRunning()).toBe(false);
    });
  });

  describe('getTasks()', () => {
    it('should return all registered tasks', () => {
      const tasks = [
        task('task1', () => {})
          .everyMinute()
          .build(),
        task('task2', () => {})
          .hourly()
          .build(),
      ];

      scheduler = createScheduler(tasks);
      const registeredTasks = scheduler.getTasks();

      expect(registeredTasks).toHaveLength(2);
      expect(registeredTasks.map((t) => t.name)).toEqual(['task1', 'task2']);
    });
  });

  describe('getTask()', () => {
    it('should return a task by name', () => {
      scheduler = createScheduler([
        task('my-task', () => {})
          .daily()
          .build(),
      ]);

      const t = scheduler.getTask('my-task');
      expect(t).toBeDefined();
      expect(t?.name).toBe('my-task');
    });

    it('should return undefined for non-existent task', () => {
      scheduler = createScheduler([]);

      expect(scheduler.getTask('non-existent')).toBeUndefined();
    });
  });

  describe('runTask()', () => {
    it('should run a task immediately', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([task('run-me', handler).everyMinute().build()]);

      const execution = await scheduler.runTask('run-me');

      expect(handler).toHaveBeenCalled();
      expect(execution.status).toBe('completed');
      expect(execution.taskName).toBe('run-me');
    });

    it('should throw for non-existent task', async () => {
      scheduler = createScheduler([]);

      await expect(scheduler.runTask('non-existent')).rejects.toThrow('Task not found');
    });

    it('should record failed execution', async () => {
      const error = new Error('Task failed');
      const handler = vi.fn().mockRejectedValue(error);

      scheduler = createScheduler([task('failing-task', handler).everyMinute().build()]);

      const execution = await scheduler.runTask('failing-task');

      expect(execution.status).toBe('failed');
      expect(execution.error).toBe('Task failed');
    });

    it('should skip overlapping execution when withoutOverlapping is set', async () => {
      let resolveTask: () => void;
      const taskPromise = new Promise<void>((resolve) => {
        resolveTask = resolve;
      });

      const handler = vi.fn().mockReturnValue(taskPromise);
      scheduler = createScheduler([
        task('overlapping', handler).everyMinute().withoutOverlapping().build(),
      ]);

      // Start first execution
      const firstExecution = scheduler.runTask('overlapping');

      // Try to run again while first is still running
      const secondExecution = await scheduler.runTask('overlapping');

      expect(secondExecution.status).toBe('skipped');
      expect(handler).toHaveBeenCalledTimes(1);

      // Complete first execution
      resolveTask?.();
      await firstExecution;
    });

    it('should accept maxLockMinutes parameter', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([
        task('with-lock', handler).everyMinute().withoutOverlapping(30).build(),
      ]);

      const t = scheduler.getTask('with-lock');
      expect(t?.maxLockMinutes).toBe(30);
    });
  });

  describe('getHistory()', () => {
    it('should return execution history', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([task('history-test', handler).everyMinute().build()]);

      await scheduler.runTask('history-test');
      await scheduler.runTask('history-test');

      const history = scheduler.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].taskName).toBe('history-test');
    });

    it('should filter history by task name', async () => {
      scheduler = createScheduler([
        task('task1', () => {})
          .everyMinute()
          .build(),
        task('task2', () => {})
          .everyMinute()
          .build(),
      ]);

      await scheduler.runTask('task1');
      await scheduler.runTask('task2');
      await scheduler.runTask('task1');

      const task1History = scheduler.getHistory('task1');
      expect(task1History).toHaveLength(2);
      expect(task1History.every((e) => e.taskName === 'task1')).toBe(true);
    });
  });

  describe('getNextRun()', () => {
    it('should return next scheduled run time', () => {
      scheduler = createScheduler([
        task('test', () => {})
          .everyMinute()
          .build(),
      ]);

      const nextRun = scheduler.getNextRun('test');
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun?.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return undefined for non-existent task', () => {
      scheduler = createScheduler([]);

      expect(scheduler.getNextRun('non-existent')).toBeUndefined();
    });
  });

  describe('isTaskRunning()', () => {
    it('should return false when task is not running', () => {
      scheduler = createScheduler([
        task('test', () => {})
          .everyMinute()
          .build(),
      ]);

      expect(scheduler.isTaskRunning('test')).toBe(false);
    });

    it('should return true when task is running', async () => {
      let resolveTask: () => void;
      const taskPromise = new Promise<void>((resolve) => {
        resolveTask = resolve;
      });

      scheduler = createScheduler([
        task('test', () => taskPromise)
          .everyMinute()
          .build(),
      ]);

      const execution = scheduler.runTask('test');

      expect(scheduler.isTaskRunning('test')).toBe(true);

      resolveTask?.();
      await execution;

      expect(scheduler.isTaskRunning('test')).toBe(false);
    });

    it('should return false for non-existent task', () => {
      scheduler = createScheduler([]);

      expect(scheduler.isTaskRunning('non-existent')).toBe(false);
    });
  });

  describe('Callbacks', () => {
    it('should call onTaskStart callback', async () => {
      const onTaskStart = vi.fn();
      scheduler = createScheduler(
        [
          task('test', () => {})
            .everyMinute()
            .build(),
        ],
        { onTaskStart }
      );

      await scheduler.runTask('test');

      expect(onTaskStart).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test' }),
        expect.objectContaining({ name: 'test' })
      );
    });

    it('should call onTaskComplete callback', async () => {
      const onTaskComplete = vi.fn();
      scheduler = createScheduler(
        [
          task('test', () => {})
            .everyMinute()
            .build(),
        ],
        {
          onTaskComplete,
        }
      );

      await scheduler.runTask('test');

      expect(onTaskComplete).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test' }),
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should call onTaskError callback', async () => {
      const onTaskError = vi.fn();
      const error = new Error('Task failed');
      scheduler = createScheduler(
        [
          task('test', () => {
            throw error;
          })
            .everyMinute()
            .build(),
        ],
        { onTaskError }
      );

      await scheduler.runTask('test');

      expect(onTaskError).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test' }),
        expect.any(Object),
        error,
        expect.any(Number)
      );
    });

    it('should call onTaskSkip callback', async () => {
      const onTaskSkip = vi.fn();
      scheduler = createScheduler(
        [
          task('test', () => {})
            .everyMinute()
            .when(() => false)
            .build(),
        ],
        { onTaskSkip }
      );

      await scheduler.runTask('test');

      expect(onTaskSkip).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test' }),
        expect.any(Object),
        expect.any(String)
      );
    });
  });

  describe('Task Callbacks', () => {
    it('should call task onSuccess callback', async () => {
      const onSuccess = vi.fn();
      scheduler = createScheduler([
        task('test', () => {})
          .everyMinute()
          .onSuccess(onSuccess)
          .build(),
      ]);

      await scheduler.runTask('test');

      expect(onSuccess).toHaveBeenCalledWith(expect.any(Object), expect.any(Number));
    });

    it('should call task onFailure callback', async () => {
      const onFailure = vi.fn();
      const error = new Error('Failed');
      scheduler = createScheduler([
        task('test', () => {
          throw error;
        })
          .everyMinute()
          .onFailure(onFailure)
          .build(),
      ]);

      await scheduler.runTask('test');

      expect(onFailure).toHaveBeenCalledWith(expect.any(Object), error, expect.any(Number));
    });

    it('should call task onSkip callback', async () => {
      const onSkip = vi.fn();
      scheduler = createScheduler([
        task('test', () => {})
          .everyMinute()
          .when(() => false)
          .onSkip(onSkip)
          .build(),
      ]);

      await scheduler.runTask('test');

      expect(onSkip).toHaveBeenCalledWith(expect.any(Object), expect.any(String));
    });
  });

  describe('Constraints', () => {
    it('should skip task when constraint returns false', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([
        task('test', handler)
          .everyMinute()
          .when(() => false)
          .build(),
      ]);

      const execution = await scheduler.runTask('test');

      expect(handler).not.toHaveBeenCalled();
      expect(execution.status).toBe('skipped');
    });

    it('should run task when constraint returns true', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([
        task('test', handler)
          .everyMinute()
          .when(() => true)
          .build(),
      ]);

      const execution = await scheduler.runTask('test');

      expect(handler).toHaveBeenCalled();
      expect(execution.status).toBe('completed');
    });

    it('should handle async constraints', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([
        task('test', handler)
          .everyMinute()
          .when(async () => true)
          .build(),
      ]);

      const execution = await scheduler.runTask('test');

      expect(handler).toHaveBeenCalled();
      expect(execution.status).toBe('completed');
    });

    it('should skip task when constraint throws', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([
        task('test', handler)
          .everyMinute()
          .when(() => {
            throw new Error('Constraint error');
          })
          .build(),
      ]);

      const execution = await scheduler.runTask('test');

      expect(handler).not.toHaveBeenCalled();
      expect(execution.status).toBe('skipped');
    });
  });

  describe('Timeout', () => {
    it('should timeout long-running tasks', async () => {
      const handler = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 5000);
          })
      );

      scheduler = createScheduler([task('test', handler).everyMinute().timeout(50).build()]);

      const execution = await scheduler.runTask('test');

      expect(execution.status).toBe('failed');
      expect(execution.error).toContain('timed out');
    });
  });
});

describe('scheduler alias', () => {
  it('should export scheduler as alias for createScheduler', async () => {
    const { scheduler } = await import('../manager.js');
    const { createScheduler } = await import('../manager.js');

    expect(scheduler).toBe(createScheduler);
  });
});
