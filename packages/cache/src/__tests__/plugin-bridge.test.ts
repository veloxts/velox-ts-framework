/**
 * @veloxts/cache - Plugin Bridge Test
 *
 * Verifies that the cache plugin mirrors `request.cache` onto the procedure
 * context (`request.context.cache`), so handlers can read `ctx.cache` without
 * needing a manual `addHook` workaround in user code.
 */
import { setupContextHook } from '@veloxts/core';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { cachePlugin } from '../plugin.js';

describe('cache plugin bridge', () => {
  it('mirrors request.cache onto request.context.cache', async () => {
    const app = Fastify({ logger: false });
    setupContextHook(app);
    await app.register(cachePlugin({ driver: 'memory' }));

    let bridgedCache: unknown;
    let directCache: unknown;
    app.get('/probe', async (request) => {
      const ctx = (request as unknown as { context?: Record<string, unknown> }).context;
      bridgedCache = ctx?.cache;
      directCache = (request as unknown as { cache?: unknown }).cache;
      return { ok: true };
    });

    const response = await app.inject({ method: 'GET', url: '/probe' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(bridgedCache).toBeDefined();
    expect(bridgedCache).toBe(directCache);
    expect(typeof (bridgedCache as { get?: unknown }).get).toBe('function');
  });
});
