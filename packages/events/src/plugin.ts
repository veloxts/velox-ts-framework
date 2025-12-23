/**
 * Events Plugin
 *
 * Fastify plugin for real-time event broadcasting.
 * Extends BaseContext with events manager access.
 */

import type { Duplex } from 'node:stream';

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

// Side-effect import for declaration merging
import '@veloxts/core';

import { type ChannelAuthSigner, createChannelAuthSigner } from './auth.js';
import { createSseDriver } from './drivers/sse.js';
import { createWsDriver } from './drivers/ws.js';
import { createManagerFromDriver } from './manager.js';
import {
  formatValidationErrors,
  SseSubscribeBodySchema,
  SseUnsubscribeBodySchema,
  validateBody,
  WsAuthBodySchema,
} from './schemas.js';
import type {
  BroadcastDriver,
  ChannelAuthorizer,
  EventsManager,
  EventsPluginOptions,
  EventsSseOptions,
  EventsWsOptions,
} from './types.js';

/**
 * Extend BaseContext with events manager.
 *
 * After registering the events plugin, `ctx.events` becomes available
 * in all procedures:
 *
 * @example
 * ```typescript
 * const createOrder = procedure
 *   .input(CreateOrderSchema)
 *   .mutation(async ({ input, ctx }) => {
 *     const order = await ctx.db.order.create({ data: input });
 *
 *     // Broadcast order creation
 *     await ctx.events.broadcast(`orders.${order.userId}`, 'order.created', order);
 *
 *     return order;
 *   });
 * ```
 */
declare module '@veloxts/core' {
  interface BaseContext {
    /** Events manager for real-time broadcasting */
    events: EventsManager;
  }
}

/**
 * Symbol for accessing events manager from Fastify instance.
 */
const EVENTS_KEY = Symbol.for('velox.events');

/**
 * Default channel authorizer that allows public channels and denies private/presence.
 */
const defaultAuthorizer: ChannelAuthorizer = (channel) => {
  // Public channels (no prefix) are allowed
  if (!channel.name.startsWith('private-') && !channel.name.startsWith('presence-')) {
    return { authorized: true };
  }
  // Private/presence channels require explicit authorization
  return { authorized: false, error: 'Authentication required' };
};

/**
 * Events plugin for Fastify.
 *
 * Registers an events manager and sets up WebSocket/SSE endpoints.
 *
 * @param options - Events plugin options (driver configuration)
 *
 * @example
 * ```typescript
 * import { eventsPlugin } from '@veloxts/events';
 *
 * // WebSocket driver (recommended)
 * app.register(eventsPlugin, {
 *   driver: 'ws',
 *   path: '/ws',
 *   redis: process.env.REDIS_URL, // For horizontal scaling
 *   authorizer: async (channel, request) => {
 *     if (channel.type === 'public') return { authorized: true };
 *     const user = await getUserFromRequest(request);
 *     if (!user) return { authorized: false, error: 'Not authenticated' };
 *     return { authorized: true, member: { id: user.id, info: { name: user.name } } };
 *   },
 * });
 *
 * // SSE driver (fallback for environments without WebSocket)
 * app.register(eventsPlugin, {
 *   driver: 'sse',
 *   path: '/events',
 * });
 * ```
 */
export function eventsPlugin(options: EventsPluginOptions = {}) {
  return fp(
    async (fastify: FastifyInstance) => {
      const authorizer = options.authorizer ?? defaultAuthorizer;
      let driver: BroadcastDriver;

      if (options.driver === 'sse') {
        const sseOptions = options as EventsSseOptions;
        const sse = createSseDriver(sseOptions);
        driver = sse;

        // Register SSE endpoint
        const path = sseOptions.path ?? '/events';
        fastify.get(path, async (request, reply) => {
          await sse.handler(request, reply);
        });

        // Register subscription endpoint with Zod validation
        fastify.post(`${path}/subscribe`, async (request, reply) => {
          const validation = validateBody(request.body, SseSubscribeBodySchema);

          if (!validation.success) {
            return reply.status(400).send(formatValidationErrors(validation.errors));
          }

          const { connectionId, channel, member } = validation.data;

          // Authorize the channel
          const channelInfo = parseChannel(channel);
          const authResult = await authorizer(channelInfo, request);

          if (!authResult.authorized) {
            return reply.status(403).send({ error: authResult.error ?? 'Unauthorized' });
          }

          sse.subscribe(connectionId, channel, authResult.member ?? member);
          return { success: true };
        });

        // Register unsubscribe endpoint with Zod validation
        fastify.post(`${path}/unsubscribe`, async (request, reply) => {
          const validation = validateBody(request.body, SseUnsubscribeBodySchema);

          if (!validation.success) {
            return reply.status(400).send(formatValidationErrors(validation.errors));
          }

          const { connectionId, channel } = validation.data;
          sse.unsubscribe(connectionId, channel);
          return { success: true };
        });
      } else {
        // WebSocket driver (default)
        const wsOptions = (
          options.driver === 'ws' ? options : { ...options, driver: 'ws' as const }
        ) as EventsWsOptions;

        const ws = await createWsDriver(wsOptions, { server: fastify.server });
        driver = ws;

        // Initialize auth signer if authSecret is provided
        let authSigner: ChannelAuthSigner | null = null;
        if (options.authSecret) {
          authSigner = createChannelAuthSigner(options.authSecret);
        }

        // Handle WebSocket upgrade
        const path = wsOptions.path ?? '/ws';

        fastify.server.on('upgrade', (request, socket: Duplex, head) => {
          const url = new URL(request.url ?? '', `http://${request.headers.host}`);
          if (url.pathname === path) {
            ws.handleUpgrade(request, socket, head);
          }
        });

        // Register auth endpoint for private/presence channels with Zod validation
        fastify.post(`${path}/auth`, async (request, reply) => {
          const validation = validateBody(request.body, WsAuthBodySchema);

          if (!validation.success) {
            return reply.status(400).send(formatValidationErrors(validation.errors));
          }

          const { socketId, channel } = validation.data;

          const channelInfo = parseChannel(channel);
          const authResult = await authorizer(channelInfo, request);

          if (!authResult.authorized) {
            return reply.status(403).send({ error: authResult.error ?? 'Unauthorized' });
          }

          // Require authSecret for private/presence channels
          if (!authSigner && channelInfo.type !== 'public') {
            return reply.status(500).send({
              error: 'Server configuration error: authSecret required for private channels',
            });
          }

          // For public channels, no signature needed
          if (channelInfo.type === 'public') {
            return { auth: null };
          }

          // Generate HMAC-SHA256 signature for secure auth
          const channelData = authResult.member ? JSON.stringify(authResult.member) : undefined;
          const signature = authSigner?.sign(socketId, channel, channelData) ?? '';

          return {
            auth: `${socketId}:${signature}`,
            channel_data: channelData,
          };
        });
      }

      // Create events manager
      const events = createManagerFromDriver(driver);

      // Store on fastify instance
      (fastify as unknown as Record<symbol, EventsManager>)[EVENTS_KEY] = events;

      // Decorate request with events accessor
      fastify.decorateRequest('events', {
        getter() {
          return events;
        },
      });

      // Register cleanup hook
      fastify.addHook('onClose', async () => {
        await events.close();
      });
    },
    {
      name: '@veloxts/events',
      fastify: '5.x',
    }
  );
}

/**
 * Parse channel name to determine type.
 */
function parseChannel(name: string): { name: string; type: 'public' | 'private' | 'presence' } {
  if (name.startsWith('presence-')) {
    return { name, type: 'presence' };
  }
  if (name.startsWith('private-')) {
    return { name, type: 'private' };
  }
  return { name, type: 'public' };
}

/**
 * Get the events manager from a Fastify instance.
 *
 * @param fastify - Fastify instance
 * @returns Events manager
 * @throws If events plugin is not registered
 *
 * @example
 * ```typescript
 * const events = getEventsFromInstance(fastify);
 * await events.broadcast('notifications', 'alert', { message: 'Hello!' });
 * ```
 */
export function getEventsFromInstance(fastify: FastifyInstance): EventsManager {
  const events = (fastify as unknown as Record<symbol, EventsManager>)[EVENTS_KEY];

  if (!events) {
    throw new Error(
      'Events plugin not registered. Register it with: app.register(eventsPlugin, { ... })'
    );
  }

  return events;
}

// =============================================================================
// Standalone Usage (outside Fastify context)
// =============================================================================

/**
 * Singleton events instance for standalone usage.
 */
let standaloneEvents: EventsManager | null = null;

/**
 * Get or create a standalone events manager.
 *
 * This is useful when you need events access outside of a Fastify request
 * context, such as in background jobs or CLI commands.
 *
 * @param options - Events options (only used on first call)
 * @returns Events manager instance
 *
 * @example
 * ```typescript
 * import { getEvents } from '@veloxts/events';
 *
 * // In a background job
 * const events = await getEvents({ driver: 'ws' });
 * await events.broadcast('jobs', 'completed', { jobId: '123' });
 * ```
 */
export async function getEvents(options?: EventsPluginOptions): Promise<EventsManager> {
  if (!standaloneEvents) {
    const { createEventsManager } = await import('./manager.js');
    standaloneEvents = await createEventsManager(options ?? {});
  }
  return standaloneEvents;
}

/**
 * Reset the standalone events instance.
 * Primarily used for testing.
 */
export async function _resetStandaloneEvents(): Promise<void> {
  if (standaloneEvents) {
    await standaloneEvents.close();
    standaloneEvents = null;
  }
}
