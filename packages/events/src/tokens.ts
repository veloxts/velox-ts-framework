/**
 * DI Tokens for @veloxts/events
 *
 * Symbol-based tokens for type-safe dependency injection.
 * These tokens allow events services to be registered, resolved, and mocked via the DI container.
 *
 * @module events/tokens
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { EVENTS_MANAGER, registerEventsProviders } from '@veloxts/events';
 *
 * const container = new Container();
 * await registerEventsProviders(container, { driver: 'ws' });
 *
 * const events = container.resolve(EVENTS_MANAGER);
 * await events.broadcast('orders', 'order.created', { id: '123' });
 * ```
 */

import { token } from '@veloxts/core';

import type { BroadcastDriver, EventsManager, EventsPluginOptions } from './types.js';

// ============================================================================
// Core Events Tokens
// ============================================================================

/**
 * Events manager token
 *
 * The main events manager instance for broadcasting events.
 *
 * @example
 * ```typescript
 * const events = container.resolve(EVENTS_MANAGER);
 * await events.broadcast('orders.123', 'order.shipped', { trackingNumber: 'TRACK123' });
 * await events.broadcastToMany(['user.1', 'user.2'], 'notification', { message: 'Hello!' });
 * ```
 */
export const EVENTS_MANAGER = token.symbol<EventsManager>('EVENTS_MANAGER');

/**
 * Broadcast driver token
 *
 * The underlying broadcast driver (WebSocket or SSE).
 * Use EVENTS_MANAGER for high-level operations; use this for direct driver access.
 *
 * @example
 * ```typescript
 * const driver = container.resolve(EVENTS_DRIVER);
 * await driver.broadcast({ channel: 'orders', event: 'created', data: { id: '123' } });
 * ```
 */
export const EVENTS_DRIVER = token.symbol<BroadcastDriver>('EVENTS_DRIVER');

// ============================================================================
// Configuration Tokens
// ============================================================================

/**
 * Events configuration token
 *
 * Contains events plugin options including driver and driver-specific config.
 *
 * @example
 * ```typescript
 * const config = container.resolve(EVENTS_CONFIG);
 * console.log(config.driver); // 'ws' or 'sse'
 * ```
 */
export const EVENTS_CONFIG = token.symbol<EventsPluginOptions>('EVENTS_CONFIG');
