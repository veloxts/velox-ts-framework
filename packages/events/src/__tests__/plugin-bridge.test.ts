/**
 * @veloxts/events - Plugin Bridge Test
 *
 * Verifies that the events plugin mirrors `request.events` onto the procedure
 * context (`request.context.events`) so handlers can read `ctx.events`.
 *
 * Uses the SSE driver since it doesn't require a real WebSocket connection.
 */
import { setupContextHook } from '@veloxts/core';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { eventsPlugin } from '../plugin.js';

describe('events plugin bridge', () => {
  it('mirrors request.events onto request.context.events', async () => {
    const app = Fastify({ logger: false });
    setupContextHook(app);
    await app.register(eventsPlugin({ driver: 'sse', path: '/sse-events' }));

    let bridgedEvents: unknown;
    let directEvents: unknown;
    app.get('/probe', async (request) => {
      const ctx = (request as unknown as { context?: Record<string, unknown> }).context;
      bridgedEvents = ctx?.events;
      directEvents = (request as unknown as { events?: unknown }).events;
      return { ok: true };
    });

    const response = await app.inject({ method: 'GET', url: '/probe' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(bridgedEvents).toBeDefined();
    expect(bridgedEvents).toBe(directEvents);
    expect(typeof (bridgedEvents as { broadcast?: unknown }).broadcast).toBe('function');
  });
});
