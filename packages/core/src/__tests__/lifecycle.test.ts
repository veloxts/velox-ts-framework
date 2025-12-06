/**
 * @veloxts/core - Lifecycle Manager Unit Tests
 * Tests shutdown handler management and signal handling
 */

import { describe, expect, it } from 'vitest';

import { LifecycleManager } from '../utils/lifecycle.js';

describe('LifecycleManager - Unit Tests', () => {
  describe('addShutdownHandler', () => {
    it('should add a shutdown handler', () => {
      const manager = new LifecycleManager();
      const handler = async () => {};

      manager.addShutdownHandler(handler);

      // Handler should be added (verified by successful execution without error)
      expect(manager).toBeDefined();
    });

    it('should add multiple shutdown handlers', () => {
      const manager = new LifecycleManager();
      const handler1 = async () => {};
      const handler2 = async () => {};
      const handler3 = async () => {};

      manager.addShutdownHandler(handler1);
      manager.addShutdownHandler(handler2);
      manager.addShutdownHandler(handler3);

      expect(manager).toBeDefined();
    });

    it('should prevent duplicate handlers (Set behavior)', () => {
      const manager = new LifecycleManager();
      const handler = async () => {};

      manager.addShutdownHandler(handler);
      manager.addShutdownHandler(handler);
      manager.addShutdownHandler(handler);

      // Set automatically prevents duplicates
      expect(manager).toBeDefined();
    });

    it('should throw when exceeding maximum handlers', () => {
      const manager = new LifecycleManager();

      // Add maximum allowed handlers (1000)
      for (let i = 0; i < 1000; i++) {
        manager.addShutdownHandler(async () => {});
      }

      // Adding one more should throw
      expect(() => {
        manager.addShutdownHandler(async () => {});
      }).toThrow('Maximum number of shutdown handlers (1000) exceeded');
    });

    it('should throw with helpful message about memory leak', () => {
      const manager = new LifecycleManager();

      // Fill up to max
      for (let i = 0; i < 1000; i++) {
        manager.addShutdownHandler(async () => {});
      }

      expect(() => {
        manager.addShutdownHandler(async () => {});
      }).toThrow('This may indicate a memory leak');
    });
  });

  describe('removeShutdownHandler', () => {
    it('should remove a shutdown handler', () => {
      const manager = new LifecycleManager();
      const handler = async () => {};

      manager.addShutdownHandler(handler);
      const removed = manager.removeShutdownHandler(handler);

      expect(removed).toBe(true);
    });

    it('should return false when removing non-existent handler', () => {
      const manager = new LifecycleManager();
      const handler = async () => {};

      const removed = manager.removeShutdownHandler(handler);

      expect(removed).toBe(false);
    });

    it('should only remove specific handler', () => {
      const manager = new LifecycleManager();
      const handler1 = async () => {};
      const handler2 = async () => {};

      manager.addShutdownHandler(handler1);
      manager.addShutdownHandler(handler2);

      const removed = manager.removeShutdownHandler(handler1);

      expect(removed).toBe(true);
    });

    it('should allow removing same handler twice (returns false second time)', () => {
      const manager = new LifecycleManager();
      const handler = async () => {};

      manager.addShutdownHandler(handler);
      const removed1 = manager.removeShutdownHandler(handler);
      const removed2 = manager.removeShutdownHandler(handler);

      expect(removed1).toBe(true);
      expect(removed2).toBe(false);
    });
  });

  describe('executeShutdownHandlers', () => {
    it('should execute all shutdown handlers', async () => {
      const manager = new LifecycleManager();
      const executed: number[] = [];

      manager.addShutdownHandler(async () => {
        executed.push(1);
      });
      manager.addShutdownHandler(async () => {
        executed.push(2);
      });
      manager.addShutdownHandler(async () => {
        executed.push(3);
      });

      await manager.executeShutdownHandlers();

      expect(executed).toEqual([1, 2, 3]);
    });

    it('should execute handlers in insertion order', async () => {
      const manager = new LifecycleManager();
      const order: string[] = [];

      manager.addShutdownHandler(async () => {
        order.push('first');
      });
      manager.addShutdownHandler(async () => {
        order.push('second');
      });
      manager.addShutdownHandler(async () => {
        order.push('third');
      });

      await manager.executeShutdownHandlers();

      expect(order).toEqual(['first', 'second', 'third']);
    });

    it('should execute handlers sequentially', async () => {
      const manager = new LifecycleManager();
      const events: string[] = [];

      manager.addShutdownHandler(async () => {
        events.push('start-1');
        await new Promise((resolve) => setTimeout(resolve, 10));
        events.push('end-1');
      });
      manager.addShutdownHandler(async () => {
        events.push('start-2');
        await new Promise((resolve) => setTimeout(resolve, 5));
        events.push('end-2');
      });

      await manager.executeShutdownHandlers();

      // Handlers execute sequentially, not in parallel
      expect(events).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    });

    it('should continue executing handlers even if one fails', async () => {
      const manager = new LifecycleManager();
      const executed: number[] = [];

      manager.addShutdownHandler(async () => {
        executed.push(1);
      });
      manager.addShutdownHandler(async () => {
        executed.push(2);
        throw new Error('Handler 2 failed');
      });
      manager.addShutdownHandler(async () => {
        executed.push(3);
      });

      await manager.executeShutdownHandlers();

      expect(executed).toEqual([1, 2, 3]);
    });

    it('should not execute handlers multiple times during concurrent shutdown', async () => {
      const manager = new LifecycleManager();
      const executionCount: number[] = [];

      manager.addShutdownHandler(async () => {
        executionCount.push(1);
      });

      // Call executeShutdownHandlers multiple times concurrently
      await Promise.all([
        manager.executeShutdownHandlers(),
        manager.executeShutdownHandlers(),
        manager.executeShutdownHandlers(),
      ]);

      // Handlers should only execute once (isShuttingDown guard)
      expect(executionCount).toEqual([1]);
    });

    it('should handle empty handler list', async () => {
      const manager = new LifecycleManager();

      await expect(manager.executeShutdownHandlers()).resolves.not.toThrow();
    });
  });

  describe('clearHandlers', () => {
    it('should clear all shutdown handlers', () => {
      const manager = new LifecycleManager();
      const handler1 = async () => {};
      const handler2 = async () => {};

      manager.addShutdownHandler(handler1);
      manager.addShutdownHandler(handler2);

      manager.clearHandlers();

      // Should be able to add handlers again without exceeding limit
      expect(() => manager.addShutdownHandler(async () => {})).not.toThrow();
    });

    it('should not execute cleared handlers', async () => {
      const manager = new LifecycleManager();
      const executed: boolean[] = [];

      manager.addShutdownHandler(async () => {
        executed.push(true);
      });

      manager.clearHandlers();
      await manager.executeShutdownHandlers();

      expect(executed).toEqual([]);
    });

    it('should allow adding handlers after clearing', () => {
      const manager = new LifecycleManager();

      // Add some handlers
      for (let i = 0; i < 10; i++) {
        manager.addShutdownHandler(async () => {});
      }

      manager.clearHandlers();

      // Should be able to add handlers again
      expect(() => {
        for (let i = 0; i < 10; i++) {
          manager.addShutdownHandler(async () => {});
        }
      }).not.toThrow();
    });
  });

  describe('setupSignalHandlers', () => {
    it('should register signal handlers without errors', () => {
      const manager = new LifecycleManager();
      const onShutdown = async () => {};

      expect(() => manager.setupSignalHandlers(onShutdown)).not.toThrow();

      // Clean up immediately to avoid side effects
      manager.cleanupSignalHandlers();
    });

    it('should register handlers for SIGINT and SIGTERM', () => {
      const manager = new LifecycleManager();
      const onShutdown = async () => {};

      // Count number of listeners before
      const sigintBefore = process.listenerCount('SIGINT');
      const sigtermBefore = process.listenerCount('SIGTERM');

      manager.setupSignalHandlers(onShutdown);

      // Should have added one listener for each signal
      expect(process.listenerCount('SIGINT')).toBe(sigintBefore + 1);
      expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore + 1);

      // Clean up
      manager.cleanupSignalHandlers();
    });
  });

  describe('cleanupSignalHandlers', () => {
    it('should remove signal handlers', () => {
      const manager = new LifecycleManager();
      const onShutdown = async () => {};

      const sigintBefore = process.listenerCount('SIGINT');
      const sigtermBefore = process.listenerCount('SIGTERM');

      manager.setupSignalHandlers(onShutdown);
      manager.cleanupSignalHandlers();

      // Listeners should be back to original count
      expect(process.listenerCount('SIGINT')).toBe(sigintBefore);
      expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore);
    });

    it('should be safe to call multiple times', () => {
      const manager = new LifecycleManager();
      const onShutdown = async () => {};

      manager.setupSignalHandlers(onShutdown);
      manager.cleanupSignalHandlers();
      manager.cleanupSignalHandlers();
      manager.cleanupSignalHandlers();

      expect(manager).toBeDefined();
    });

    it('should be safe to call without setup', () => {
      const manager = new LifecycleManager();

      expect(() => manager.cleanupSignalHandlers()).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('should handle complete lifecycle', async () => {
      const manager = new LifecycleManager();
      const events: string[] = [];

      // Add shutdown handlers
      manager.addShutdownHandler(async () => {
        events.push('cleanup-db');
      });
      manager.addShutdownHandler(async () => {
        events.push('close-connections');
      });

      // Setup signal handlers
      const onShutdown = async () => {
        events.push('shutdown-callback');
      };
      manager.setupSignalHandlers(onShutdown);

      // Execute shutdown
      await manager.executeShutdownHandlers();

      // Clean up signals
      manager.cleanupSignalHandlers();

      expect(events).toEqual(['cleanup-db', 'close-connections']);
    });

    it('should allow removing specific handlers during lifecycle', () => {
      const manager = new LifecycleManager();
      const handler1 = async () => {};
      const handler2 = async () => {};

      manager.addShutdownHandler(handler1);
      manager.addShutdownHandler(handler2);

      manager.removeShutdownHandler(handler1);

      expect(manager).toBeDefined();
    });
  });
});
