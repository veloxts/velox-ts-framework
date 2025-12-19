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

describe('content type handling', () => {
  it('should handle application/x-www-form-urlencoded body', async () => {
    const app = Fastify();
    // Register content type parser for form data
    app.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string' },
      (_req, payload, done) => {
        const params = new URLSearchParams(payload as string);
        const result: Record<string, string> = {};
        for (const [key, value] of params.entries()) {
          result[key] = value;
        }
        done(null, result);
      }
    );
    app.post('/form', async (request) => {
      const body = request.body as Record<string, string>;
      return { received: body };
    });

    const handler = createApiHandler({ app, basePath: '/api' });
    const request = new Request('http://localhost:3030/api/form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=John&age=30',
    });
    const response = await handler(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.received.name).toBe('John');
    expect(data.received.age).toBe('30');

    await app.close();
  });

  it('should handle multipart/form-data body', async () => {
    const app = Fastify();
    app.post('/upload', async (request) => {
      // Just verify the request was received
      return { received: true };
    });

    const handler = createApiHandler({ app, basePath: '/api' });

    // Create a simple multipart form data
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const body = `------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nHello World\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--\r\n`;

    const request = new Request('http://localhost:3030/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const response = await handler(request);

    // Fastify will return 415 since we haven't registered multipart parser
    // but we're testing that the adapter correctly passes the buffer
    expect([200, 415]).toContain(response.status);

    await app.close();
  });

  it('should handle text/plain body', async () => {
    const app = Fastify();
    app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, payload, done) => {
      done(null, payload);
    });
    app.post('/text', async (request) => {
      return { text: request.body };
    });

    const handler = createApiHandler({ app, basePath: '/api' });
    const request = new Request('http://localhost:3030/api/text', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'Hello, World!',
    });
    const response = await handler(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.text).toBe('Hello, World!');

    await app.close();
  });
});

describe('response header handling', () => {
  it('should handle array header values', async () => {
    const app = Fastify();
    app.get('/multi-header', async (_request, reply) => {
      reply.header('Set-Cookie', ['session=abc', 'theme=dark']);
      return { ok: true };
    });

    const handler = createApiHandler({ app, basePath: '/api' });
    const request = new Request('http://localhost:3030/api/multi-header');
    const response = await handler(request);

    expect(response.status).toBe(200);
    // Multiple Set-Cookie headers should be present
    const setCookies = response.headers.getSetCookie();
    expect(setCookies.length).toBe(2);
    expect(setCookies).toContain('session=abc');
    expect(setCookies).toContain('theme=dark');

    await app.close();
  });

  it('should handle undefined header values gracefully', async () => {
    const app = Fastify();
    app.get('/headers', async () => {
      return { ok: true };
    });

    const handler = createApiHandler({ app, basePath: '/api' });
    const request = new Request('http://localhost:3030/api/headers');
    const response = await handler(request);

    expect(response.status).toBe(200);
    // Should not throw when iterating headers
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');

    await app.close();
  });
});
