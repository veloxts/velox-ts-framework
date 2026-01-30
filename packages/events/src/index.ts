/**
 * @veloxts/events
 *
 * Real-time event broadcasting for VeloxTS framework.
 *
 * Features:
 * - WebSocket driver with ws library
 * - SSE driver for fallback
 * - Channel authorization (public, private, presence)
 * - Redis pub/sub for horizontal scaling
 * - Fastify plugin with BaseContext extension
 *
 * @example
 * ```typescript
 * import { eventsPlugin } from '@veloxts/events';
 *
 * // Register the plugin
 * app.register(eventsPlugin, {
 *   driver: 'ws',
 *   path: '/ws',
 *   redis: process.env.REDIS_URL,
 * });
 *
 * // In a procedure
 * const createOrder = procedure
 *   .input(CreateOrderSchema)
 *   .mutation(async ({ input, ctx }) => {
 *     const order = await ctx.db.order.create({ data: input });
 *
 *     // Broadcast to subscribers
 *     await ctx.events.broadcast(`orders.${order.userId}`, 'order.created', order);
 *
 *     return order;
 *   });
 * ```
 *
 * @packageDocumentation
 */

// Auth
export { type ChannelAuthSigner, createChannelAuthSigner } from './auth.js';
// Drivers
export { createSseDriver, DRIVER_NAME as SSE_DRIVER } from './drivers/sse.js';
export { createWsDriver, DRIVER_NAME as WS_DRIVER } from './drivers/ws.js';
// Manager
export {
  createEventsManager,
  createManagerFromDriver,
  type EventsManager,
  events,
} from './manager.js';
// Plugin
export {
  _resetStandaloneEvents,
  closeEvents,
  eventsPlugin,
  getEvents,
  getEventsFromInstance,
} from './plugin.js';
// Schemas (for validation)
export {
  ClientMessageSchema,
  formatValidationErrors,
  PresenceMemberSchema,
  SseSubscribeBodySchema,
  SseUnsubscribeBodySchema,
  type ValidationResult,
  validateBody,
  WsAuthBodySchema,
} from './schemas.js';
// Types
export type {
  // Driver interface
  BroadcastDriver,
  // Event types
  BroadcastEvent,
  // Channel types
  Channel,
  ChannelAuthorizer,
  ChannelAuthResult,
  ChannelType,
  // Connection types
  ClientConnection,
  ClientMessage,
  // Configuration types (discriminated unions)
  EventsBaseOptions,
  EventsDefaultOptions,
  EventsManagerOptions,
  EventsPluginOptions,
  EventsSseOptions,
  EventsWsOptions,
  PresenceMember,
  ServerMessage,
  Subscription,
} from './types.js';

// ============================================================================
// Dependency Injection
// ============================================================================

/**
 * DI tokens and providers for @veloxts/events
 *
 * Use these to integrate events services with the @veloxts/core DI container.
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerEventsProviders, EVENTS_MANAGER } from '@veloxts/events';
 *
 * const container = new Container();
 * await registerEventsProviders(container, { driver: 'ws' });
 *
 * const events = container.resolve(EVENTS_MANAGER);
 * await events.broadcast('orders', 'order.created', { id: '123' });
 * ```
 */

// Provider exports - factory functions for registering services
export { registerEventsProviders } from './providers.js';
// Token exports - unique identifiers for DI resolution
export { EVENTS_CONFIG, EVENTS_DRIVER, EVENTS_MANAGER } from './tokens.js';
