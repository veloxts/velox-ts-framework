/**
 * @veloxts/mail - Plugin Bridge Test
 *
 * Verifies that the mail plugin mirrors `request.mail` onto the procedure
 * context (`request.context.mail`) so handlers can read `ctx.mail`.
 */
import { setupContextHook } from '@veloxts/core';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { mailPlugin } from '../plugin.js';

describe('mail plugin bridge', () => {
  it('mirrors request.mail onto request.context.mail', async () => {
    const app = Fastify({ logger: false });
    setupContextHook(app);
    await app.register(mailPlugin({ driver: 'log' }));

    let bridgedMail: unknown;
    let directMail: unknown;
    app.get('/probe', async (request) => {
      const ctx = (request as unknown as { context?: Record<string, unknown> }).context;
      bridgedMail = ctx?.mail;
      directMail = (request as unknown as { mail?: unknown }).mail;
      return { ok: true };
    });

    const response = await app.inject({ method: 'GET', url: '/probe' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(bridgedMail).toBeDefined();
    expect(bridgedMail).toBe(directMail);
    expect(typeof (bridgedMail as { send?: unknown }).send).toBe('function');
  });
});
