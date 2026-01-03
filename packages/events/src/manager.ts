/**
 * Events Manager
 *
 * High-level API for real-time event broadcasting.
 * Wraps the underlying driver with a clean, Laravel-inspired interface.
 */

import type {
  BroadcastDriver,
  BroadcastEvent,
  EventsManager,
  EventsPluginOptions,
  EventsSseOptions,
  EventsWsOptions,
  PresenceMember,
} from './types.js';

/**
 * Create an events manager with the specified driver.
 *
 * @param options - Events configuration with driver selection
 * @returns Events manager instance
 *
 * @example
 * ```typescript
 * // WebSocket driver (default)
 * const events = await createEventsManager({
 *   driver: 'ws',
 *   path: '/ws',
 *   redis: process.env.REDIS_URL, // For scaling
 * });
 *
 * // SSE driver (fallback)
 * const events = await createEventsManager({
 *   driver: 'sse',
 *   path: '/events',
 * });
 *
 * // Broadcast an event
 * await events.broadcast('orders.123', 'order.shipped', {
 *   trackingNumber: 'TRACK123',
 * });
 * ```
 */
export async function createEventsManager(
  options: EventsPluginOptions = {}
): Promise<EventsManager & { driver: BroadcastDriver }> {
  let driver: BroadcastDriver;

  if (options.driver === 'sse') {
    const sseOptions = options as EventsSseOptions;
    const { createSseDriver } = await import('./drivers/sse.js');
    driver = createSseDriver(sseOptions);
  } else {
    // WebSocket driver (default)
    const wsOptions = (
      options.driver === 'ws' ? options : { ...options, driver: 'ws' as const }
    ) as EventsWsOptions;
    const { createWsDriver } = await import('./drivers/ws.js');
    driver = await createWsDriver(wsOptions);
  }

  return createManagerFromDriver(driver);
}

/**
 * Create an events manager from an existing driver.
 *
 * @param driver - Broadcast driver instance
 * @returns Events manager instance
 */
export function createManagerFromDriver(
  driver: BroadcastDriver
): EventsManager & { driver: BroadcastDriver } {
  const manager: EventsManager & { driver: BroadcastDriver } = {
    driver,

    async broadcast<T>(channel: string, event: string, data: T, except?: string): Promise<void> {
      const broadcastEvent: BroadcastEvent<T> = {
        channel,
        event,
        data,
        except,
      };
      await driver.broadcast(broadcastEvent);
    },

    async broadcastToMany<T>(channels: string[], event: string, data: T): Promise<void> {
      await Promise.all(
        channels.map((channel) =>
          driver.broadcast({
            channel,
            event,
            data,
          })
        )
      );
    },

    async broadcastExcept<T>(
      channel: string,
      event: string,
      data: T,
      except: string
    ): Promise<void> {
      await driver.broadcast({
        channel,
        event,
        data,
        except,
      });
    },

    /**
     * @deprecated Use `broadcastExcept()` instead. Will be removed in v2.0.
     */
    async toOthers<T>(channel: string, event: string, data: T, except: string): Promise<void> {
      // Runtime deprecation warning (development only)
      if (process.env.NODE_ENV === 'development') {
        console.warn('[@veloxts/events] toOthers() is deprecated. Use broadcastExcept() instead.');
      }
      await this.broadcastExcept(channel, event, data, except);
    },

    async subscriberCount(channel: string): Promise<number> {
      return driver.getConnectionCount(channel);
    },

    async presenceMembers(channel: string): Promise<PresenceMember[]> {
      return driver.getPresenceMembers(channel);
    },

    async hasSubscribers(channel: string): Promise<boolean> {
      const count = await driver.getConnectionCount(channel);
      return count > 0;
    },

    async channels(): Promise<string[]> {
      return driver.getChannels();
    },

    async close(): Promise<void> {
      await driver.close();
    },
  };

  return manager;
}

/**
 * Alias for createEventsManager for Laravel-style API.
 */
export const events = createEventsManager;

/**
 * Re-export manager type.
 */
export type { EventsManager };
