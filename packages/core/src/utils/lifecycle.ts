/**
 * Lifecycle management utilities for VeloxTS application
 * Handles graceful shutdown and cleanup
 * @module utils/lifecycle
 */

import type { ShutdownHandler } from '../types.js';

/**
 * Manages graceful shutdown for the VeloxTS application
 *
 * Coordinates cleanup of resources when the application is stopped,
 * either programmatically or via system signals (SIGINT, SIGTERM)
 */
export class LifecycleManager {
  private readonly shutdownHandlers: Set<ShutdownHandler> = new Set();
  private readonly signalHandlers: Map<NodeJS.Signals, () => void> = new Map();
  private isShuttingDown = false;
  private static readonly MAX_SHUTDOWN_HANDLERS = 1000;

  /**
   * Adds a shutdown handler to be called during graceful shutdown
   *
   * Handlers are called in insertion order. Duplicate handlers are
   * automatically prevented.
   *
   * @param handler - Async function to call during shutdown
   * @throws {Error} If maximum number of handlers is exceeded
   *
   * @example
   * ```typescript
   * lifecycleManager.addShutdownHandler(async () => {
   *   await database.disconnect();
   *   console.log('Database connection closed');
   * });
   * ```
   */
  addShutdownHandler(handler: ShutdownHandler): void {
    // Prevent memory leaks from unbounded growth
    if (this.shutdownHandlers.size >= LifecycleManager.MAX_SHUTDOWN_HANDLERS) {
      throw new Error(
        `Maximum number of shutdown handlers (${LifecycleManager.MAX_SHUTDOWN_HANDLERS}) exceeded. ` +
          'This may indicate a memory leak.'
      );
    }

    // Set automatically prevents duplicates
    this.shutdownHandlers.add(handler);
  }

  /**
   * Removes a shutdown handler
   *
   * @param handler - Handler to remove
   * @returns true if handler was removed, false if not found
   */
  removeShutdownHandler(handler: ShutdownHandler): boolean {
    return this.shutdownHandlers.delete(handler);
  }

  /**
   * Executes all shutdown handlers in sequence
   *
   * Called automatically during server stop() or when receiving
   * termination signals (SIGINT, SIGTERM)
   *
   * @internal
   */
  async executeShutdownHandlers(): Promise<void> {
    if (this.isShuttingDown) {
      return; // Already shutting down, avoid duplicate execution
    }

    this.isShuttingDown = true;

    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        // Log error but continue with other handlers
        console.error('Error during shutdown handler execution:', error);
      }
    }

    this.isShuttingDown = false;
  }

  /**
   * Sets up process signal handlers for graceful shutdown
   *
   * Listens for SIGINT (Ctrl+C) and SIGTERM (kill command) and
   * executes shutdown sequence before exiting
   *
   * @param onShutdown - Callback to execute during shutdown
   *
   * @internal
   */
  setupSignalHandlers(onShutdown: () => Promise<void>): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    signals.forEach((signal) => {
      const handler = async () => {
        console.log(`\nReceived ${signal}, initiating graceful shutdown...`);

        try {
          await onShutdown();
          console.log('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      };

      // Store handler reference so it can be removed later
      this.signalHandlers.set(signal, handler);
      process.once(signal, handler);
    });
  }

  /**
   * Removes all signal handlers
   *
   * Should be called during stop() to prevent memory leaks in test environments
   *
   * @internal
   */
  cleanupSignalHandlers(): void {
    for (const [signal, handler] of this.signalHandlers) {
      process.removeListener(signal, handler);
    }
    this.signalHandlers.clear();
  }

  /**
   * Clears all registered shutdown handlers
   *
   * @internal
   */
  clearHandlers(): void {
    this.shutdownHandlers.clear();
  }
}
