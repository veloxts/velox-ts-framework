/**
 * Tests for the SSR router
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RouteMatch } from '../types.js';
import { createSsrRouter, type H3Event } from './ssr-router.js';

/**
 * Creates a mock H3Event for testing purposes.
 * Captures the response body and headers for assertions.
 */
function createMockH3Event(
  url: string,
  method = 'GET'
): {
  event: H3Event;
  getResponse: () => { status: number; headers: Map<string, string>; body: string };
} {
  const responseHeaders = new Map<string, string>();
  const chunks: unknown[] = [];
  let statusCode = 200;

  const parsedUrl = new URL(url);

  const event: H3Event = {
    node: {
      req: {
        method,
        url: parsedUrl.pathname + parsedUrl.search,
        headers: {
          host: parsedUrl.host,
        },
      },
      res: {
        get statusCode() {
          return statusCode;
        },
        set statusCode(value: number) {
          statusCode = value;
        },
        setHeader(name: string, value: string | string[]) {
          responseHeaders.set(name.toLowerCase(), Array.isArray(value) ? value.join(', ') : value);
        },
        write(chunk: unknown) {
          chunks.push(chunk);
          return true;
        },
        end(data?: unknown) {
          if (data !== undefined) {
            chunks.push(data);
          }
        },
        on(_event: string, _listener: () => void) {
          // No-op for tests
        },
      },
    },
  };

  const getResponse = () => ({
    status: statusCode,
    headers: responseHeaders,
    body: chunks
      .map((c) => (c instanceof Uint8Array ? new TextDecoder().decode(c) : String(c)))
      .join(''),
  });

  return { event, getResponse };
}

describe('createSsrRouter', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('basic functionality', () => {
    it('should create a handler function', () => {
      const handler = createSsrRouter({
        resolveRoute: async () => null,
        render: async () => new Response('OK'),
      });

      expect(typeof handler).toBe('function');
    });

    it('should call resolveRoute with pathname', async () => {
      const resolveRoute = vi.fn(async () => null);

      const handler = createSsrRouter({
        resolveRoute,
        render: async () => new Response('OK'),
      });

      const { event } = createMockH3Event('http://localhost:3030/users');
      await handler(event);

      expect(resolveRoute).toHaveBeenCalledWith('/users');
    });

    it('should call render when route is matched', async () => {
      const match: RouteMatch = {
        route: {
          filePath: 'users.tsx',
          pattern: '/users',
          params: [],
          catchAll: false,
        },
        params: {},
      };

      const render = vi.fn(async () => new Response('Rendered'));

      const handler = createSsrRouter({
        resolveRoute: async () => match,
        render,
      });

      const { event } = createMockH3Event('http://localhost:3030/users');
      await handler(event);

      expect(render).toHaveBeenCalledWith(match, expect.any(Request));
    });

    it('should return the rendered response', async () => {
      const match: RouteMatch = {
        route: {
          filePath: 'about.tsx',
          pattern: '/about',
          params: [],
          catchAll: false,
        },
        params: {},
      };

      const handler = createSsrRouter({
        resolveRoute: async () => match,
        render: async () => new Response('About page', { status: 200 }),
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/about');
      await handler(event);

      const response = getResponse();
      expect(response.status).toBe(200);
      expect(response.body).toBe('About page');
    });

    it('should handle routes with parameters', async () => {
      const match: RouteMatch = {
        route: {
          filePath: 'users/[id].tsx',
          pattern: '/users/:id',
          params: ['id'],
          catchAll: false,
        },
        params: { id: '123' },
      };

      const render = vi.fn(async () => new Response('User 123'));

      const handler = createSsrRouter({
        resolveRoute: async () => match,
        render,
      });

      const { event } = createMockH3Event('http://localhost:3030/users/123');
      await handler(event);

      expect(render).toHaveBeenCalledWith(match, expect.any(Request));
    });
  });

  describe('404 handling', () => {
    it('should use default 404 handler when no route matches', async () => {
      const handler = createSsrRouter({
        resolveRoute: async () => null,
        render: async () => new Response('OK'),
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/unknown');
      await handler(event);

      const response = getResponse();
      expect(response.status).toBe(404);
      expect(response.body).toContain('404');
      expect(response.body).toContain('Not Found');
    });

    it('should use custom 404 handler', async () => {
      const notFound = vi.fn(async () => new Response('Custom 404', { status: 404 }));

      const handler = createSsrRouter({
        resolveRoute: async () => null,
        render: async () => new Response('OK'),
        notFound,
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/missing');
      await handler(event);

      expect(notFound).toHaveBeenCalledWith(expect.any(Request));
      const response = getResponse();
      expect(response.status).toBe(404);
      expect(response.body).toBe('Custom 404');
    });

    it('should return HTML with proper content type for default 404', async () => {
      const handler = createSsrRouter({
        resolveRoute: async () => null,
        render: async () => new Response('OK'),
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/nope');
      await handler(event);

      const response = getResponse();
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    });

    it('should include link to home in default 404', async () => {
      const handler = createSsrRouter({
        resolveRoute: async () => null,
        render: async () => new Response('OK'),
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/404');
      await handler(event);

      const response = getResponse();
      expect(response.body).toContain('href="/"');
      expect(response.body).toContain('Back to home');
    });
  });

  describe('error handling', () => {
    it('should catch errors during route resolution', async () => {
      const handler = createSsrRouter({
        resolveRoute: async () => {
          throw new Error('Route resolution failed');
        },
        render: async () => new Response('OK'),
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/users');
      await handler(event);

      expect(getResponse().status).toBe(500);
    });

    it('should catch errors during rendering', async () => {
      const match: RouteMatch = {
        route: {
          filePath: 'error.tsx',
          pattern: '/error',
          params: [],
          catchAll: false,
        },
        params: {},
      };

      const handler = createSsrRouter({
        resolveRoute: async () => match,
        render: async () => {
          throw new Error('Render failed');
        },
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/error');
      await handler(event);

      expect(getResponse().status).toBe(500);
    });

    it('should use custom error handler', async () => {
      const onError = vi.fn(async () => new Response('Custom error', { status: 500 }));

      const handler = createSsrRouter({
        resolveRoute: async () => {
          throw new Error('Test error');
        },
        render: async () => new Response('OK'),
        onError,
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/test');
      await handler(event);

      expect(onError).toHaveBeenCalled();
      const [error, req] = onError.mock.calls[0];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(req).toBeInstanceOf(Request);
      expect(getResponse().body).toBe('Custom error');
    });

    it('should convert non-Error values to Error', async () => {
      const onError = vi.fn(async () => new Response('Error handled', { status: 500 }));

      const handler = createSsrRouter({
        resolveRoute: async () => {
          throw 'String error';
        },
        render: async () => new Response('OK'),
        onError,
      });

      const { event } = createMockH3Event('http://localhost:3030/test');
      await handler(event);

      expect(onError).toHaveBeenCalled();
      const [error] = onError.mock.calls[0];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('String error');
    });

    it('should show error details in development', async () => {
      process.env.NODE_ENV = 'development';

      const handler = createSsrRouter({
        resolveRoute: async () => {
          const error = new Error('Dev error');
          error.stack = 'Error: Dev error\n  at test.ts:1:1';
          throw error;
        },
        render: async () => new Response('OK'),
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/test');
      await handler(event);

      const html = getResponse().body;
      expect(html).toContain('Error: Dev error');
      expect(html).toContain('at test.ts:1:1');
    });

    it('should hide error details in production', async () => {
      process.env.NODE_ENV = 'production';

      const handler = createSsrRouter({
        resolveRoute: async () => {
          const error = new Error('Sensitive error');
          error.stack = 'Error: Sensitive error\n  at secret.ts:100:1';
          throw error;
        },
        render: async () => new Response('OK'),
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/test');
      await handler(event);

      const html = getResponse().body;
      expect(html).not.toContain('Sensitive error');
      expect(html).not.toContain('secret.ts');
      expect(html).toContain('500');
      expect(html).toContain('Something went wrong');
    });

    it('should return HTML with proper content type for errors', async () => {
      const handler = createSsrRouter({
        resolveRoute: async () => {
          throw new Error('Test');
        },
        render: async () => new Response('OK'),
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/test');
      await handler(event);

      expect(getResponse().headers.get('content-type')).toBe('text/html; charset=utf-8');
    });

    it('should escape HTML in error messages to prevent XSS', async () => {
      process.env.NODE_ENV = 'development';

      const handler = createSsrRouter({
        resolveRoute: async () => {
          throw new Error('<script>alert("xss")</script>');
        },
        render: async () => new Response('OK'),
      });

      const { event, getResponse } = createMockH3Event('http://localhost:3030/test');
      await handler(event);

      const html = getResponse().body;
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&quot;xss&quot;');
    });
  });

  describe('logging', () => {
    it('should log successful renders in development', async () => {
      process.env.NODE_ENV = 'development';

      const match: RouteMatch = {
        route: {
          filePath: 'home.tsx',
          pattern: '/',
          params: [],
          catchAll: false,
        },
        params: {},
      };

      const handler = createSsrRouter({
        resolveRoute: async () => match,
        render: async () => new Response('Home', { status: 200 }),
      });

      const { event } = createMockH3Event('http://localhost:3030/');
      await handler(event);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('[SSR]');
      expect(logCall).toContain('/');
      expect(logCall).toContain('200');
    });

    it('should not log in production by default', async () => {
      process.env.NODE_ENV = 'production';

      const match: RouteMatch = {
        route: {
          filePath: 'home.tsx',
          pattern: '/',
          params: [],
          catchAll: false,
        },
        params: {},
      };

      const handler = createSsrRouter({
        resolveRoute: async () => match,
        render: async () => new Response('Home'),
      });

      const { event } = createMockH3Event('http://localhost:3030/');
      await handler(event);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log when explicitly enabled', async () => {
      process.env.NODE_ENV = 'production';

      const handler = createSsrRouter({
        resolveRoute: async () => null,
        render: async () => new Response('OK'),
        logging: true,
      });

      const { event } = createMockH3Event('http://localhost:3030/test');
      await handler(event);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should not log when explicitly disabled', async () => {
      process.env.NODE_ENV = 'development';

      const match: RouteMatch = {
        route: {
          filePath: 'test.tsx',
          pattern: '/test',
          params: [],
          catchAll: false,
        },
        params: {},
      };

      const handler = createSsrRouter({
        resolveRoute: async () => match,
        render: async () => new Response('Test'),
        logging: false,
      });

      const { event } = createMockH3Event('http://localhost:3030/test');
      await handler(event);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log 404 responses', async () => {
      process.env.NODE_ENV = 'development';

      const handler = createSsrRouter({
        resolveRoute: async () => null,
        render: async () => new Response('OK'),
      });

      const { event } = createMockH3Event('http://localhost:3030/missing');
      await handler(event);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('[SSR]');
      expect(logCall).toContain('/missing');
      expect(logCall).toContain('404');
    });

    it('should log errors with console.error', async () => {
      process.env.NODE_ENV = 'development';

      const handler = createSsrRouter({
        resolveRoute: async () => {
          throw new Error('Log test');
        },
        render: async () => new Response('OK'),
      });

      const { event } = createMockH3Event('http://localhost:3030/error');
      await handler(event);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorLog = consoleErrorSpy.mock.calls[0][0];
      expect(errorLog).toContain('[SSR]');
      expect(errorLog).toContain('/error');
      expect(errorLog).toContain('ERROR');
    });

    it('should include elapsed time in logs', async () => {
      process.env.NODE_ENV = 'development';

      const match: RouteMatch = {
        route: {
          filePath: 'test.tsx',
          pattern: '/test',
          params: [],
          catchAll: false,
        },
        params: {},
      };

      const handler = createSsrRouter({
        resolveRoute: async () => match,
        render: async () => new Response('Test'),
      });

      const { event } = createMockH3Event('http://localhost:3030/test');
      await handler(event);

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toMatch(/\d+\.\d+ms/);
    });

    it('should include error object in error logs', async () => {
      process.env.NODE_ENV = 'development';

      const handler = createSsrRouter({
        resolveRoute: async () => {
          throw new Error('Test error');
        },
        render: async () => new Response('OK'),
      });

      const { event } = createMockH3Event('http://localhost:3030/error');
      await handler(event);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][1]).toBeInstanceOf(Error);
    });
  });

  describe('query parameters', () => {
    it('should handle routes with query parameters', async () => {
      const match: RouteMatch = {
        route: {
          filePath: 'search.tsx',
          pattern: '/search',
          params: [],
          catchAll: false,
        },
        params: {},
      };

      const render = vi.fn(async () => new Response('Search results'));

      const handler = createSsrRouter({
        resolveRoute: async () => match,
        render,
      });

      const { event } = createMockH3Event('http://localhost:3030/search?q=test&page=1');
      await handler(event);

      expect(render).toHaveBeenCalledWith(match, expect.any(Request));
      // Verify the request URL contains query parameters
      const passedRequest = render.mock.calls[0][1] as Request;
      expect(passedRequest.url).toContain('q=test');
      expect(passedRequest.url).toContain('page=1');
    });
  });

  describe('catch-all routes', () => {
    it('should handle catch-all routes', async () => {
      const match: RouteMatch = {
        route: {
          filePath: '[...slug].tsx',
          pattern: '/*',
          params: ['slug'],
          catchAll: true,
        },
        params: { slug: 'docs/guide/intro' },
      };

      const render = vi.fn(async () => new Response('Docs page'));

      const handler = createSsrRouter({
        resolveRoute: async () => match,
        render,
      });

      const { event } = createMockH3Event('http://localhost:3030/docs/guide/intro');
      await handler(event);

      expect(render).toHaveBeenCalledWith(match, expect.any(Request));
    });
  });
});
