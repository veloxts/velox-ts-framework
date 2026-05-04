/**
 * @veloxts/router - raw() Response Primitive Tests
 *
 * Verifies that procedures returning raw responses bypass JSON serialization
 * and apply headers/cookies/redirect/body directly to the Fastify reply.
 */
import cookiePlugin from '@fastify/cookie';
import { veloxApp } from '@veloxts/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineProcedures, procedure } from '../procedure/builder.js';
import { isRawResponse, raw } from '../raw.js';
import { registerRestRoutes } from '../rest/index.js';

describe('raw()', () => {
  describe('factory and type guard', () => {
    it('produces a branded RawResponse', () => {
      const r = raw({ status: 204 });
      expect(isRawResponse(r)).toBe(true);
    });

    it('handles bare raw({}) (empty 200)', () => {
      const r = raw();
      expect(isRawResponse(r)).toBe(true);
    });

    it('isRawResponse rejects non-raw values', () => {
      expect(isRawResponse(undefined)).toBe(false);
      expect(isRawResponse(null)).toBe(false);
      expect(isRawResponse({})).toBe(false);
      expect(isRawResponse({ status: 200 })).toBe(false);
      expect(isRawResponse('string')).toBe(false);
      expect(isRawResponse(42)).toBe(false);
    });

    it('preserves all options on the branded object', () => {
      const r = raw({
        status: 418,
        headers: { 'X-Custom': 'value' },
        body: 'teapot',
      });
      expect(r.status).toBe(418);
      expect(r.headers).toEqual({ 'X-Custom': 'value' });
      expect(r.body).toBe('teapot');
    });
  });

  describe('REST adapter integration', () => {
    let app: Awaited<ReturnType<typeof veloxApp>>;

    beforeEach(async () => {
      app = await veloxApp({ port: 0, logger: false });
    });

    afterEach(async () => {
      if (app.isRunning) await app.stop();
    });

    it('issues a 302 redirect when redirect is set', async () => {
      const oauth = defineProcedures('oauth', {
        startAuth: procedure()
          .rest({ method: 'GET', path: '/auth/start' })
          .query(async () => raw({ redirect: { url: 'https://example.com/authorize' } })),
      });

      registerRestRoutes(app.server, [oauth]);
      await app.start();

      const response = await app.server.inject({ method: 'GET', url: '/api/auth/start' });
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('https://example.com/authorize');
    });

    it('honors a custom redirect status', async () => {
      const oauth = defineProcedures('oauth', {
        permanentRedirect: procedure()
          .rest({ method: 'GET', path: '/old' })
          .query(async () => raw({ redirect: { url: '/new', status: 308 } })),
      });

      registerRestRoutes(app.server, [oauth]);
      await app.start();

      const response = await app.server.inject({ method: 'GET', url: '/api/old' });
      expect(response.statusCode).toBe(308);
      expect(response.headers.location).toBe('/new');
    });

    it('applies custom status and headers', async () => {
      const downloads = defineProcedures('downloads', {
        getFile: procedure()
          .input(z.object({ id: z.string() }))
          .rest({ method: 'GET', path: '/files/:id' })
          .query(async ({ input }) =>
            raw({
              status: 200,
              headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${input.id}.bin"`,
              },
              body: Buffer.from('payload'),
            })
          ),
      });

      registerRestRoutes(app.server, [downloads]);
      await app.start();

      const response = await app.server.inject({ method: 'GET', url: '/api/files/abc' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/octet-stream');
      expect(response.headers['content-disposition']).toBe('attachment; filename="abc.bin"');
      expect(response.body).toBe('payload');
    });

    it('sends a string body without JSON-serializing it', async () => {
      const text = defineProcedures('text', {
        listText: procedure()
          .rest({ method: 'GET', path: '/text' })
          .query(async () =>
            raw({
              headers: { 'Content-Type': 'text/plain' },
              body: 'hello world',
            })
          ),
      });

      registerRestRoutes(app.server, [text]);
      await app.start();

      const response = await app.server.inject({ method: 'GET', url: '/api/text' });
      expect(response.body).toBe('hello world');
      expect(response.headers['content-type']).toBe('text/plain');
    });

    it('returns an empty 200 body when no body and no redirect are set', async () => {
      const ping = defineProcedures('ping', {
        listPing: procedure()
          .rest({ method: 'GET', path: '/ping' })
          .query(async () => raw({ status: 204 })),
      });

      registerRestRoutes(app.server, [ping]);
      await app.start();

      const response = await app.server.inject({ method: 'GET', url: '/api/ping' });
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
    });

    it('does NOT apply create-resource 201 status to raw responses', async () => {
      // Regression: the auto 201 on procedures named create*/add* must not
      // override a raw() response's explicit status.
      const oauth = defineProcedures('oauth', {
        createSession: procedure()
          .rest({ method: 'POST', path: '/oauth/session' })
          .mutation(async () => raw({ redirect: { url: '/dashboard', status: 302 } })),
      });

      registerRestRoutes(app.server, [oauth]);
      await app.start();

      const response = await app.server.inject({ method: 'POST', url: '/api/oauth/session' });
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/dashboard');
    });
  });

  describe('cookies', () => {
    let app: Awaited<ReturnType<typeof veloxApp>>;

    beforeEach(async () => {
      app = await veloxApp({ port: 0, logger: false });
      await app.server.register(cookiePlugin);
    });

    afterEach(async () => {
      if (app.isRunning) await app.stop();
    });

    it('sets cookies via reply.setCookie when @fastify/cookie is registered', async () => {
      const auth = defineProcedures('auth', {
        startSession: procedure()
          .rest({ method: 'POST', path: '/auth/session' })
          .mutation(async () =>
            raw({
              cookies: [
                {
                  name: 'session',
                  value: 'abc123',
                  options: { httpOnly: true, path: '/', sameSite: 'lax' },
                },
              ],
              redirect: { url: '/dashboard', status: 302 },
            })
          ),
      });

      registerRestRoutes(app.server, [auth]);
      await app.start();

      const response = await app.server.inject({ method: 'POST', url: '/api/auth/session' });
      expect(response.statusCode).toBe(302);
      const setCookie = response.headers['set-cookie'];
      const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(cookieHeader).toContain('session=abc123');
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('SameSite=Lax');
    });

    it('throws ConfigurationError when cookies set without @fastify/cookie', async () => {
      // Use a fresh app without the cookie plugin
      const naked = await veloxApp({ port: 0, logger: false });
      try {
        const auth = defineProcedures('auth', {
          startSession: procedure()
            .rest({ method: 'POST', path: '/auth/session' })
            .mutation(async () =>
              raw({ cookies: [{ name: 'session', value: 'abc' }], status: 200 })
            ),
        });

        registerRestRoutes(naked.server, [auth]);
        await naked.start();

        const response = await naked.server.inject({ method: 'POST', url: '/api/auth/session' });
        // ConfigurationError → 500 by default error handler
        expect(response.statusCode).toBe(500);
        expect(response.json()).toMatchObject({
          message: expect.stringContaining('@fastify/cookie'),
        });
      } finally {
        if (naked.isRunning) await naked.stop();
      }
    });
  });
});
