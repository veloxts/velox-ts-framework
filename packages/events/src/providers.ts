/**
 * DI Providers for @veloxts/events
 *
 * Factory provider functions for registering events services with the DI container.
 * These providers allow services to be managed by the container for testability and flexibility.
 *
 * @module events/providers
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerEventsProviders, EVENTS_MANAGER } from '@veloxts/events';
 *
 * const container = new Container();
 * await registerEventsProviders(container, {
 *   driver: 'ws',
 *   path: '/ws',
 * });
 *
 * const events = container.resolve(EVENTS_MANAGER);
 * await events.broadcast('orders', 'order.created', { id: '123' });
 * ```
 */

import type { Container } from '@veloxts/core';

import { createEventsManager } from './manager.js';
import { EVENTS_CONFIG, EVENTS_DRIVER, EVENTS_MANAGER } from './tokens.js';
import type { EventsPluginOptions } from './types.js';

// ============================================================================
// Bulk Registration Helpers
// ============================================================================

/**
 * Registers events providers with a container
 *
 * This handles async initialization of the events manager and registers
 * the resolved instance directly for synchronous resolution.
 *
 * @param container - The DI container to register providers with
 * @param config - Events plugin options (driver, path, etc.)
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerEventsProviders, EVENTS_MANAGER } from '@veloxts/events';
 *
 * const container = new Container();
 *
 * // WebSocket driver (default, recommended for real-time)
 * await registerEventsProviders(container, {
 *   driver: 'ws',
 *   path: '/ws',
 *   redis: process.env.REDIS_URL, // For horizontal scaling
 * });
 *
 * // SSE driver (fallback for environments without WebSocket)
 * await registerEventsProviders(container, {
 *   driver: 'sse',
 *   path: '/events',
 * });
 *
 * const events = container.resolve(EVENTS_MANAGER);
 * await events.broadcast('orders.123', 'order.shipped', { trackingNumber: 'TRACK123' });
 * ```
 */
export async function registerEventsProviders(
  container: Container,
  config: EventsPluginOptions = {}
): Promise<void> {
  // Register config
  container.register({
    provide: EVENTS_CONFIG,
    useValue: config,
  });

  // Create events manager (async operation)
  const eventsManager = await createEventsManager(config);

  // Register the driver for direct access
  container.register({
    provide: EVENTS_DRIVER,
    useValue: eventsManager.driver,
  });

  // Register the resolved events manager instance directly
  // This allows synchronous resolution from the container
  container.register({
    provide: EVENTS_MANAGER,
    useValue: eventsManager,
  });
}
