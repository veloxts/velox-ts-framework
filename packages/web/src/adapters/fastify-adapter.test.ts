/**
 * Tests for the Fastify → Web API adapter
 */

import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApiHandler, isFastifyInstance } from './fastify-adapter.js';

describe('createApiHandler', () => {
  describe('basic functionality', () => {
    let app: ReturnType<typeof Fastify>;
    let handler: ReturnType<typeof createApiHandler>;

    beforeAll(async () => {
      app = Fastify();

      // Register a simple test route
      app.get('/users', async () => {
        return { users: [{ id: '1', name: 'Alice' }] };
      });

      app.get('/users/:id', async (request) => {
        const { id } = request.params as { id: string };
        return { id, name: 'Alice' };
      });

      app.post('/users', async (request) => {
        const body = request.body as { name: string };
        return { id: '2', name: body.name };
      });

      handler = createApiHandler({ app, basePath: '/api' });
    });

    afterAll(async () => {
      await app.close();
    });

    it('should handle GET requests', async () => {
      const request = new Request('http://localhost:3030/api/users');
      const response = await handler(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.users).toHaveLength(1);
      expect(data.users[0].name).toBe('Alice');
    });

    it('should handle GET requests with path parameters', async () => {
      const request = new Request('http://localhost:3030/api/users/123');
      const response = await handler(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('123');
    });

    it('should handle POST requests with JSON body', async () => {
      const request = new Request('http://localhost:3030/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bob' }),
      });
      const response = await handler(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Bob');
    });

    it('should strip the base path correctly', async () => {
      const request = new Request('http://localhost:3030/api/users');
      const response = await handler(request);

      expect(response.status).toBe(200);
    });

    it('should handle query parameters', async () => {
      const app2 = Fastify();
      app2.get('/search', async (request) => {
        const query = request.query as { q: string };
        return { query: query.q };
      });

      const handler2 = createApiHandler({ app: app2, basePath: '/api' });
      const request = new Request('http://localhost:3030/api/search?q=test');
      const response = await handler2(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.query).toBe('test');

      await app2.close();
    });

    it('should return 404 for unknown routes', async () => {
      const request = new Request('http://localhost:3030/api/unknown');
      const response = await handler(request);

      expect(response.status).toBe(404);
    });
  });

  describe('error handling', () => {
    it('should handle timeout', async () => {
      const app = Fastify();
      app.get('/slow', async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { ok: true };
      });

      const handler = createApiHandler({
        app,
        basePath: '/api',
        timeout: 50,
      });

      const request = new Request('http://localhost:3030/api/slow');
      const response = await handler(request);

      expect(response.status).toBe(504);
      const data = await response.json();
      expect(data.error).toContain('timeout');

      await app.close();
    });

    it('should handle server errors gracefully', async () => {
      const app = Fastify();
      app.get('/error', async () => {
        throw new Error('Test error');
      });

      const handler = createApiHandler({ app, basePath: '/api' });
      const request = new Request('http://localhost:3030/api/error');
      const response = await handler(request);

      expect(response.status).toBe(500);
    });
  });
});

describe('isFastifyInstance', () => {
  it('should return true for a Fastify instance', () => {
    const app = Fastify();
    expect(isFastifyInstance(app)).toBe(true);
  });

  it('should return false for non-Fastify objects', () => {
    expect(isFastifyInstance({})).toBe(false);
    expect(isFastifyInstance(null)).toBe(false);
    expect(isFastifyInstance(undefined)).toBe(false);
    expect(isFastifyInstance('string')).toBe(false);
    expect(isFastifyInstance({ inject: 'not a function' })).toBe(false);
  });
});
