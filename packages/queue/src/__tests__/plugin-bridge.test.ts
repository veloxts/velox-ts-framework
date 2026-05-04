/**
 * @veloxts/queue - Plugin Bridge Test
 *
 * Verifies that the queue plugin mirrors `request.queue` onto the procedure
 * context (`request.context.queue`) so handlers can read `ctx.queue`.
 */
import { setupContextHook } from '@veloxts/core';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { queuePlugin } from '../plugin.js';

describe('queue plugin bridge', () => {
  it('mirrors request.queue onto request.context.queue', async () => {
    const app = Fastify({ logger: false });
    setupContextHook(app);
    await app.register(queuePlugin({ driver: 'sync' }));

    let bridgedQueue: unknown;
    let directQueue: unknown;
    app.get('/probe', async (request) => {
      const ctx = (request as unknown as { context?: Record<string, unknown> }).context;
      bridgedQueue = ctx?.queue;
      directQueue = (request as unknown as { queue?: unknown }).queue;
      return { ok: true };
    });

    const response = await app.inject({ method: 'GET', url: '/probe' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(bridgedQueue).toBeDefined();
    expect(bridgedQueue).toBe(directQueue);
    expect(typeof (bridgedQueue as { dispatch?: unknown }).dispatch).toBe('function');
  });
});
