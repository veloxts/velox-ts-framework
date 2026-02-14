/**
 * Scheduler Integration Tests
 *
 * Tests the scheduler in realistic scenarios covering task execution,
 * overlap prevention, timeouts, callbacks, constraints, and lifecycle.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createScheduler } from '../manager.js';
import { task } from '../task.js';

describe('Scheduler Integration', () => {
  let scheduler: ReturnType<typeof createScheduler>;

  afterEach(async () => {
    if (scheduler) {
      await scheduler.stop();
    }
  });

  describe('runTask()', () => {
    it('should execute a task and record history', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([task('test-task', handler).everyMinute().build()]);

      const execution = await scheduler.runTask('test-task');

      expect(handler).toHaveBeenCalledOnce();
      expect(execution.status).toBe('completed');
      expect(execution.taskName).toBe('test-task');
      expect(execution.duration).toBeGreaterThanOrEqual(0);

      const history = scheduler.getHistory('test-task');
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('completed');
    });

    it('should throw for unknown task', async () => {
      scheduler = createScheduler([]);
      await expect(scheduler.runTask('nonexistent')).rejects.toThrow('Task not found');
    });

    it('should provide task context to handler', async () => {
      let capturedCtx: unknown;
      const handler = vi.fn((ctx) => {
        capturedCtx = ctx;
      });

      scheduler = createScheduler([task('ctx-task', handler).everyMinute().build()]);

      await scheduler.runTask('ctx-task');

      const ctx = capturedCtx as Record<string, unknown>;
      expect(ctx).toBeDefined();
      expect(ctx.name).toBe('ctx-task');
      expect(ctx.scheduledAt).toBeInstanceOf(Date);
      expect(ctx.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('withoutOverlapping', () => {
    it('should skip overlapping executions', async () => {
      let resolveTask: (() => void) | undefined;
      const slowHandler = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveTask = resolve;
          })
      );

      scheduler = createScheduler([
        task('slow-task', slowHandler).everyMinute().withoutOverlapping().build(),
      ]);

      // Start first execution (will hang until we resolve)
      const firstRun = scheduler.runTask('slow-task');

      // Wait a tick for the handler to start
      await new Promise((r) => setTimeout(r, 10));

      // Second execution should be skipped
      const secondRun = await scheduler.runTask('slow-task');
      expect(secondRun.status).toBe('skipped');

      // Resolve first execution
      resolveTask?.();
      const firstResult = await firstRun;
      expect(firstResult.status).toBe('completed');

      // Verify handler was only called once
      expect(slowHandler).toHaveBeenCalledOnce();
    });

    it('should allow execution after previous completes', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([
        task('sequential-task', handler).everyMinute().withoutOverlapping().build(),
      ]);

      const first = await scheduler.runTask('sequential-task');
      expect(first.status).toBe('completed');

      const second = await scheduler.runTask('sequential-task');
      expect(second.status).toBe('completed');

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('timeout', () => {
    it('should fail task that exceeds timeout', async () => {
      scheduler = createScheduler([
        task('timeout-task', () => new Promise((r) => setTimeout(r, 5000)))
          .everyMinute()
          .timeout(50)
          .build(),
      ]);

      const execution = await scheduler.runTask('timeout-task');
      expect(execution.status).toBe('failed');
      expect(execution.error).toContain('timed out');
    });

    it('should succeed if task completes within timeout', async () => {
      scheduler = createScheduler([
        task('fast-task', () => Promise.resolve())
          .everyMinute()
          .timeout(5000)
          .build(),
      ]);

      const execution = await scheduler.runTask('fast-task');
      expect(execution.status).toBe('completed');
    });
  });

  describe('callbacks', () => {
    it('should invoke onSuccess callback', async () => {
      const onSuccess = vi.fn();
      scheduler = createScheduler([
        task('success-task', vi.fn()).everyMinute().onSuccess(onSuccess).build(),
      ]);

      await scheduler.runTask('success-task');
      expect(onSuccess).toHaveBeenCalledOnce();
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'success-task' }),
        expect.any(Number)
      );
    });

    it('should invoke onFailure callback on error', async () => {
      const onFailure = vi.fn();
      scheduler = createScheduler([
        task('fail-task', () => {
          throw new Error('test error');
        })
          .everyMinute()
          .onFailure(onFailure)
          .build(),
      ]);

      await scheduler.runTask('fail-task');
      expect(onFailure).toHaveBeenCalledOnce();
      expect(onFailure.mock.calls[0][1]).toBeInstanceOf(Error);
    });

    it('should invoke onSkip callback when overlapping', async () => {
      let resolveTask: (() => void) | undefined;
      const onSkip = vi.fn();
      const slowHandler = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveTask = resolve;
          })
      );

      scheduler = createScheduler([
        task('skip-task', slowHandler).everyMinute().withoutOverlapping().onSkip(onSkip).build(),
      ]);

      const firstRun = scheduler.runTask('skip-task');
      await new Promise((r) => setTimeout(r, 10));

      await scheduler.runTask('skip-task');
      expect(onSkip).toHaveBeenCalledOnce();

      resolveTask?.();
      await firstRun;
    });

    it('should invoke global onTaskStart and onTaskComplete', async () => {
      const onTaskStart = vi.fn();
      const onTaskComplete = vi.fn();

      scheduler = createScheduler([task('cb-task', vi.fn()).everyMinute().build()], {
        onTaskStart,
        onTaskComplete,
      });

      await scheduler.runTask('cb-task');
      expect(onTaskStart).toHaveBeenCalledOnce();
      expect(onTaskComplete).toHaveBeenCalledOnce();
    });

    it('should invoke global onTaskError on failure', async () => {
      const onTaskError = vi.fn();
      const error = new Error('boom');

      scheduler = createScheduler(
        [
          task('err-task', () => {
            throw error;
          })
            .everyMinute()
            .build(),
        ],
        { onTaskError }
      );

      await scheduler.runTask('err-task');
      expect(onTaskError).toHaveBeenCalledOnce();
      expect(onTaskError).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'err-task' }),
        expect.any(Object),
        error,
        expect.any(Number)
      );
    });
  });

  describe('lifecycle', () => {
    it('should start and stop the scheduler', async () => {
      scheduler = createScheduler([task('lifecycle-task', vi.fn()).everyMinute().build()]);

      expect(scheduler.isRunning()).toBe(false);
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
      await scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should report task list', () => {
      scheduler = createScheduler([
        task('task-a', vi.fn()).daily().build(),
        task('task-b', vi.fn()).hourly().build(),
      ]);

      const tasks = scheduler.getTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.name)).toEqual(['task-a', 'task-b']);
    });

    it('should get next run time', () => {
      scheduler = createScheduler([task('next-run-task', vi.fn()).daily().at('03:00').build()]);

      scheduler.start();
      const nextRun = scheduler.getNextRun('next-run-task');
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun?.getTime()).toBeGreaterThan(Date.now());
    });

    it('should track isTaskRunning correctly', async () => {
      let resolveTask: (() => void) | undefined;
      const handler = () =>
        new Promise<void>((resolve) => {
          resolveTask = resolve;
        });

      scheduler = createScheduler([task('running-check', handler).everyMinute().build()]);

      expect(scheduler.isTaskRunning('running-check')).toBe(false);

      const execution = scheduler.runTask('running-check');
      expect(scheduler.isTaskRunning('running-check')).toBe(true);

      resolveTask?.();
      await execution;
      expect(scheduler.isTaskRunning('running-check')).toBe(false);
    });
  });

  describe('constraints', () => {
    it('should skip task when constraint returns false', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([
        task('constrained-task', handler)
          .everyMinute()
          .when(() => false)
          .build(),
      ]);

      const execution = await scheduler.runTask('constrained-task');
      expect(execution.status).toBe('skipped');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should run task when all constraints pass', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([
        task('multi-constraint', handler)
          .everyMinute()
          .when(() => true)
          .when(() => true)
          .build(),
      ]);

      const execution = await scheduler.runTask('multi-constraint');
      expect(execution.status).toBe('completed');
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should skip task when any constraint fails', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([
        task('partial-constraint', handler)
          .everyMinute()
          .when(() => true)
          .when(() => false)
          .build(),
      ]);

      const execution = await scheduler.runTask('partial-constraint');
      expect(execution.status).toBe('skipped');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should support async constraints', async () => {
      const handler = vi.fn();
      scheduler = createScheduler([
        task('async-constraint', handler)
          .everyMinute()
          .when(async () => true)
          .build(),
      ]);

      const execution = await scheduler.runTask('async-constraint');
      expect(execution.status).toBe('completed');
    });
  });

  describe('multiple tasks', () => {
    it('should execute multiple tasks independently', async () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      scheduler = createScheduler([
        task('multi-a', handlerA).everyMinute().build(),
        task('multi-b', handlerB).everyMinute().build(),
      ]);

      await scheduler.runTask('multi-a');
      expect(handlerA).toHaveBeenCalledOnce();
      expect(handlerB).not.toHaveBeenCalled();

      await scheduler.runTask('multi-b');
      expect(handlerB).toHaveBeenCalledOnce();
    });

    it('should maintain separate history for each task', async () => {
      scheduler = createScheduler([
        task('hist-a', vi.fn()).everyMinute().build(),
        task('hist-b', vi.fn()).everyMinute().build(),
      ]);

      await scheduler.runTask('hist-a');
      await scheduler.runTask('hist-a');
      await scheduler.runTask('hist-b');

      expect(scheduler.getHistory('hist-a')).toHaveLength(2);
      expect(scheduler.getHistory('hist-b')).toHaveLength(1);
      expect(scheduler.getHistory()).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    it('should handle non-Error thrown values', async () => {
      scheduler = createScheduler([
        task('string-throw', () => {
          throw 'string error';
        })
          .everyMinute()
          .build(),
      ]);

      const execution = await scheduler.runTask('string-throw');
      expect(execution.status).toBe('failed');
      expect(execution.error).toBe('string error');
    });

    it('should not crash when callback throws', async () => {
      const onSuccess = vi.fn(() => {
        throw new Error('callback error');
      });

      scheduler = createScheduler([
        task('callback-crash', vi.fn()).everyMinute().onSuccess(onSuccess).build(),
      ]);

      const execution = await scheduler.runTask('callback-crash');
      expect(execution.status).toBe('completed');
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });
});
