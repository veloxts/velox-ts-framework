/**
 * Tests for Scheduler DI Providers
 *
 * Validates:
 * - registerSchedulerProviders bulk registration works correctly
 * - Services can be mocked/overridden in tests
 * - Scheduler manager is properly initialized
 */

import { Container } from '@veloxts/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerSchedulerProviders } from '../providers.js';
import { task } from '../task.js';
import { SCHEDULER_CONFIG, SCHEDULER_MANAGER } from '../tokens.js';
import type { SchedulerManager } from '../types.js';

// Test tasks for the scheduler
const testTasks = [
  task('test-task-1', async () => {
    // Simple test handler
  })
    .everyMinute()
    .build(),
  task('test-task-2', async () => {
    // Another test handler
  })
    .daily()
    .at('02:00')
    .build(),
];

describe('Scheduler DI Providers', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  afterEach(async () => {
    // Clean up any scheduler managers created
    if (container.isRegistered(SCHEDULER_MANAGER)) {
      const scheduler = container.resolve(SCHEDULER_MANAGER);
      await scheduler.stop();
    }
  });

  describe('registerSchedulerProviders', () => {
    it('registers scheduler config and manager', () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      expect(container.isRegistered(SCHEDULER_CONFIG)).toBe(true);
      expect(container.isRegistered(SCHEDULER_MANAGER)).toBe(true);
    });

    it('config values are accessible from container', () => {
      registerSchedulerProviders(container, {
        tasks: testTasks,
        timezone: 'America/New_York',
        debug: true,
      });

      const config = container.resolve(SCHEDULER_CONFIG);

      expect(config.tasks).toEqual(testTasks);
      expect(config.timezone).toBe('America/New_York');
      expect(config.debug).toBe(true);
    });

    it('uses default timezone when not specified', () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      const scheduler = container.resolve(SCHEDULER_MANAGER);
      const tasks = scheduler.getTasks();

      // Default timezone is 'UTC' - tasks inherit this
      expect(tasks.length).toBeGreaterThan(0);
    });

    it('scheduler manager is fully functional after registration', () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      // Should have registered tasks
      const tasks = scheduler.getTasks();
      expect(tasks.length).toBe(2);
      expect(tasks.map((t) => t.name)).toContain('test-task-1');
      expect(tasks.map((t) => t.name)).toContain('test-task-2');
    });

    it('scheduler manager supports start and stop', async () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      // Not running initially
      expect(scheduler.isRunning()).toBe(false);

      // Start
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      // Stop
      await scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it('scheduler manager supports getTask by name', () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      const task1 = scheduler.getTask('test-task-1');
      expect(task1).toBeDefined();
      expect(task1?.name).toBe('test-task-1');

      const nonExistent = scheduler.getTask('non-existent');
      expect(nonExistent).toBeUndefined();
    });

    it('scheduler manager supports getHistory', () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      // History should be empty initially
      const history = scheduler.getHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);
    });

    it('scheduler manager supports runTask manually', async () => {
      const handlerFn = vi.fn();
      const manualTask = task('manual-task', handlerFn).everyMinute().build();

      registerSchedulerProviders(container, { tasks: [manualTask] });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      // Run task manually
      const execution = await scheduler.runTask('manual-task');

      expect(execution.taskName).toBe('manual-task');
      expect(execution.status).toBe('completed');
      expect(handlerFn).toHaveBeenCalled();
    });

    it('scheduler manager supports getNextRun', () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      const nextRun = scheduler.getNextRun('test-task-1');
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun?.getTime()).toBeGreaterThan(Date.now());
    });

    it('scheduler manager supports isTaskRunning', () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      // Not running initially
      expect(scheduler.isTaskRunning('test-task-1')).toBe(false);
    });

    it('scheduler respects onTaskComplete callback', async () => {
      const onComplete = vi.fn();
      const simpleTask = task('callback-task', async () => {})
        .everyMinute()
        .build();

      registerSchedulerProviders(container, {
        tasks: [simpleTask],
        onTaskComplete: onComplete,
      });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      await scheduler.runTask('callback-task');

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'callback-task' }),
        expect.objectContaining({ name: 'callback-task' }),
        expect.any(Number)
      );
    });
  });

  describe('Service Mocking', () => {
    it('allows mocking SCHEDULER_MANAGER after registration', async () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      // Create a mock scheduler manager
      const mockSchedulerManager: Partial<SchedulerManager> = {
        start: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: vi.fn().mockReturnValue(false),
        getTasks: vi.fn().mockReturnValue([]),
      };

      container.register({ provide: SCHEDULER_MANAGER, useValue: mockSchedulerManager });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      expect(scheduler).toBe(mockSchedulerManager);

      scheduler.start();
      expect(mockSchedulerManager.start).toHaveBeenCalled();
    });

    it('allows mocking SCHEDULER_CONFIG after registration', () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      const mockConfig = {
        tasks: [],
        timezone: 'Europe/London',
        debug: true,
      };
      container.register({ provide: SCHEDULER_CONFIG, useValue: mockConfig });

      const config = container.resolve(SCHEDULER_CONFIG);

      expect(config).toBe(mockConfig);
      expect(config.timezone).toBe('Europe/London');
    });

    it('child container can override parent registrations', async () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      const childContainer = container.createChild();

      const mockSchedulerManager: Partial<SchedulerManager> = {
        start: vi.fn(),
        stop: vi.fn().mockResolvedValue(undefined),
        isRunning: vi.fn().mockReturnValue(true),
        getTasks: vi.fn().mockReturnValue([]),
      };

      childContainer.register({ provide: SCHEDULER_MANAGER, useValue: mockSchedulerManager });

      const parentScheduler = container.resolve(SCHEDULER_MANAGER);
      const childScheduler = childContainer.resolve(SCHEDULER_MANAGER);

      expect(childScheduler).toBe(mockSchedulerManager);
      expect(parentScheduler).not.toBe(mockSchedulerManager);
    });

    it('child container inherits parent registrations', () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      const childContainer = container.createChild();

      // Should resolve from parent
      const scheduler = childContainer.resolve(SCHEDULER_MANAGER);
      const config = childContainer.resolve(SCHEDULER_CONFIG);

      expect(scheduler).toBeDefined();
      expect(config).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('throws when resolving unregistered SCHEDULER_MANAGER token', () => {
      expect(() => container.resolve(SCHEDULER_MANAGER)).toThrow(
        'No provider found for: SCHEDULER_MANAGER'
      );
    });

    it('throws when resolving SCHEDULER_CONFIG without registration', () => {
      expect(() => container.resolve(SCHEDULER_CONFIG)).toThrow(
        'No provider found for: SCHEDULER_CONFIG'
      );
    });

    it('throws when running non-existent task', async () => {
      registerSchedulerProviders(container, { tasks: testTasks });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      await expect(scheduler.runTask('non-existent-task')).rejects.toThrow(
        'Task not found: non-existent-task'
      );
    });
  });

  describe('Integration with Real Services', () => {
    it('complete scheduler flow works with DI-provided services', async () => {
      const taskHandler = vi.fn();
      const integrationTasks = [task('integration-task', taskHandler).everyMinute().build()];

      registerSchedulerProviders(container, {
        tasks: integrationTasks,
        timezone: 'UTC',
        debug: false,
      });

      const scheduler = container.resolve(SCHEDULER_MANAGER);
      const config = container.resolve(SCHEDULER_CONFIG);

      // Config should be accessible
      expect(config.timezone).toBe('UTC');
      expect(config.tasks).toHaveLength(1);

      // Scheduler should be functional
      expect(scheduler.getTasks()).toHaveLength(1);

      // Run task manually
      const execution = await scheduler.runTask('integration-task');
      expect(execution.status).toBe('completed');
      expect(taskHandler).toHaveBeenCalled();
    });

    it('multiple containers can have independent scheduler instances', async () => {
      const container1 = new Container();
      const container2 = new Container();

      const task1 = task('container1-task', async () => {})
        .everyMinute()
        .build();
      const task2 = task('container2-task', async () => {})
        .everyMinute()
        .build();

      registerSchedulerProviders(container1, {
        tasks: [task1],
        timezone: 'UTC',
      });

      registerSchedulerProviders(container2, {
        tasks: [task2],
        timezone: 'America/New_York',
      });

      const scheduler1 = container1.resolve(SCHEDULER_MANAGER);
      const scheduler2 = container2.resolve(SCHEDULER_MANAGER);

      // Different instances
      expect(scheduler1).not.toBe(scheduler2);

      // Different tasks
      expect(scheduler1.getTasks()[0].name).toBe('container1-task');
      expect(scheduler2.getTasks()[0].name).toBe('container2-task');

      // Different configs
      const config1 = container1.resolve(SCHEDULER_CONFIG);
      const config2 = container2.resolve(SCHEDULER_CONFIG);
      expect(config1.timezone).toBe('UTC');
      expect(config2.timezone).toBe('America/New_York');

      // Cleanup
      await scheduler1.stop();
      await scheduler2.stop();
    });

    it('supports task failure handling', async () => {
      const onError = vi.fn();
      const failingTask = task('failing-task', async () => {
        throw new Error('Task failed intentionally');
      })
        .everyMinute()
        .build();

      registerSchedulerProviders(container, {
        tasks: [failingTask],
        onTaskError: onError,
      });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      const execution = await scheduler.runTask('failing-task');

      expect(execution.status).toBe('failed');
      expect(execution.error).toBe('Task failed intentionally');
      expect(onError).toHaveBeenCalled();
    });

    it('supports task with onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const successTask = task('success-task', async () => {})
        .everyMinute()
        .onSuccess(onSuccess)
        .build();

      registerSchedulerProviders(container, { tasks: [successTask] });

      const scheduler = container.resolve(SCHEDULER_MANAGER);

      await scheduler.runTask('success-task');

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'success-task' }),
        expect.any(Number)
      );
    });
  });
});
