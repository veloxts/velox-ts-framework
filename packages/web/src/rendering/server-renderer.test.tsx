/**
 * Tests for Server-Side Renderer
 */

import { describe, expect, it, vi } from 'vitest';

import type { RouteMatch } from '../types.js';
import { renderToStream } from './server-renderer.js';

// Simple test page component
function TestPage({
  params,
  searchParams,
}: {
  params: Record<string, string>;
  searchParams: Record<string, string>;
}) {
  return (
    <div data-testid="test-page">
      <h1>Test Page</h1>
      <p>Params: {JSON.stringify(params)}</p>
      <p>Search: {JSON.stringify(searchParams)}</p>
    </div>
  );
}

// Async test page component
async function AsyncTestPage({ params }: { params: Record<string, string> }) {
  // Simulate async operation
  await new Promise((resolve) => setTimeout(resolve, 10));
  return (
    <div data-testid="async-page">
      <h1>Async Page</h1>
      <p>ID: {params.id}</p>
    </div>
  );
}

// Error-throwing component
function ErrorPage() {
  throw new Error('Test render error');
}

describe('renderToStream', () => {
  // Create a mock route match
  function createRouteMatch(overrides: Partial<RouteMatch> = {}): RouteMatch {
    return {
      route: {
        filePath: 'test-page.tsx',
        pattern: '/test',
        params: [],
        catchAll: false,
        ...overrides.route,
      },
      params: overrides.params ?? {},
    };
  }

  describe('basic rendering', () => {
    it('should render a page component with custom resolver', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: [],
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');

      const html = await response.text();
      expect(html).toContain('Test Page');
      expect(html).toContain('data-testid="test-page"');
    });

    it('should include DOCTYPE and HTML structure', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: [],
      });

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
    });

    it('should render with bootstrap scripts', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: ['/client.js'],
      });

      const html = await response.text();
      expect(html).toContain('/client.js');
    });
  });

  describe('params and search params', () => {
    it('should pass route params to page component', async () => {
      const match = createRouteMatch({
        params: { id: '123', slug: 'test-post' },
      });
      const request = new Request('http://localhost:3030/posts/123/test-post');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: [],
      });

      const html = await response.text();
      // React HTML-encodes quotes in attributes
      expect(html).toContain('&quot;id&quot;:&quot;123&quot;');
      expect(html).toContain('&quot;slug&quot;:&quot;test-post&quot;');
    });

    it('should extract search params from request URL', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test?page=1&sort=desc');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: [],
      });

      const html = await response.text();
      // React HTML-encodes quotes
      expect(html).toContain('&quot;page&quot;:&quot;1&quot;');
      expect(html).toContain('&quot;sort&quot;:&quot;desc&quot;');
    });

    it('should handle empty search params', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: [],
      });

      const html = await response.text();
      // React adds HTML comment markers between text nodes
      expect(html).toMatch(/Search:.*{}/);
    });

    it('should preserve duplicate search params as arrays', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test?tag=a&tag=b&tag=c');

      // Custom component to display array values
      function ArrayParamsPage({
        searchParams,
      }: {
        params: Record<string, string>;
        searchParams: Record<string, string | string[]>;
      }) {
        const tags = searchParams.tag;
        const isArray = Array.isArray(tags);
        return (
          <div data-testid="array-params">
            <p>Is Array: {String(isArray)}</p>
            <p>Count: {isArray ? tags.length : 1}</p>
          </div>
        );
      }

      const response = await renderToStream(match, request, {
        resolveComponent: async () => ArrayParamsPage,
        bootstrapScripts: [],
      });

      const html = await response.text();
      // React adds HTML comment markers between text nodes
      expect(html).toMatch(/Is Array:.*true/);
      expect(html).toMatch(/Count:.*3/);
    });
  });

  describe('async components', () => {
    it('should render async server components', async () => {
      const match = createRouteMatch({
        params: { id: '456' },
      });
      const request = new Request('http://localhost:3030/async/456');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => AsyncTestPage,
        bootstrapScripts: [],
      });

      const html = await response.text();
      expect(html).toContain('Async Page');
      // React adds HTML comment markers between text nodes
      expect(html).toMatch(/ID:.*456/);
    });
  });

  describe('options', () => {
    it('should use custom Document component', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      // Custom Document that adds a custom class
      async function CustomDocument({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en" className="custom-doc">
            <head>
              <meta charSet="UTF-8" />
            </head>
            <body>
              <div id="root">{children}</div>
            </body>
          </html>
        );
      }

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        DocumentComponent: CustomDocument as typeof import('./document.js').Document,
        bootstrapScripts: [],
      });

      const html = await response.text();
      expect(html).toContain('class="custom-doc"');
    });

    it('should pass initial data to Document', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: [],
        initialData: { user: { name: 'Test' } },
      });

      const html = await response.text();
      expect(html).toContain('__velox_data__');
    });

    it('should pass head content to Document', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: [],
        head: <title>Custom Title</title>,
      });

      const html = await response.text();
      expect(html).toContain('<title>Custom Title</title>');
    });
  });

  describe('error handling', () => {
    it('should return 500 on render error', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/error');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => ErrorPage,
        bootstrapScripts: [],
        onError: vi.fn(),
      });

      expect(response.status).toBe(500);
    });

    it('should call onError callback on error', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/error');
      const onError = vi.fn();

      await renderToStream(match, request, {
        resolveComponent: async () => ErrorPage,
        bootstrapScripts: [],
        onError,
      });

      expect(onError).toHaveBeenCalled();
    });

    it('should return error HTML page on error', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/error');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => ErrorPage,
        bootstrapScripts: [],
        onError: vi.fn(),
      });

      const html = await response.text();
      expect(html).toContain('Server Render Error');
    });

    it('should handle missing component', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/missing');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => {
          throw new Error('Component not found');
        },
        bootstrapScripts: [],
        onError: vi.fn(),
      });

      expect(response.status).toBe(500);
    });

    it('should reject path traversal attempts', async () => {
      // Create a route match with a malicious file path
      const match = createRouteMatch({
        route: {
          filePath: '../../../etc/passwd',
          pattern: '/malicious',
          params: [],
          catchAll: false,
        },
      });
      const request = new Request('http://localhost:3030/malicious');
      const onError = vi.fn();

      // Don't provide resolveComponent to test importPageComponent's path validation
      const response = await renderToStream(match, request, {
        bootstrapScripts: [],
        onError,
      });

      expect(response.status).toBe(500);
      expect(onError).toHaveBeenCalled();
      const errorArg = onError.mock.calls[0][0] as Error;
      expect(errorArg.message).toContain('path traversal detected');
    });
  });

  describe('response headers', () => {
    it('should set correct content type', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: [],
      });

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });

    it('should set transfer-encoding for streaming', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: [],
      });

      expect(response.headers.get('Transfer-Encoding')).toBe('chunked');
    });

    it('should set X-Content-Type-Options header', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: [],
      });

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('shell timeout', () => {
    it('should timeout on long render', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/slow');
      const onError = vi.fn();

      // Component that never resolves
      async function SlowPage() {
        await new Promise(() => {}); // Never resolves
        return <div>Never renders</div>;
      }

      try {
        await renderToStream(match, request, {
          resolveComponent: async () => SlowPage,
          bootstrapScripts: [],
          shellTimeout: 50,
          onError,
        });
      } catch {
        // Expected to throw
      }

      // onError should be called with timeout error
      expect(onError).toHaveBeenCalled();
    }, 1000);
  });

  describe('error response', () => {
    it('should show stack trace in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/error');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => ErrorPage,
        bootstrapScripts: [],
        onError: vi.fn(),
      });

      const html = await response.text();
      expect(html).toContain('<pre>'); // Stack trace in pre tag
      expect(html).toContain('Test render error');

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide stack trace in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/error');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => ErrorPage,
        bootstrapScripts: [],
        onError: vi.fn(),
      });

      const html = await response.text();
      expect(html).toContain('Test render error');
      // Should not include pre tag with stack
      expect(html).not.toMatch(/<pre>.*Error\s+at/);

      process.env.NODE_ENV = originalEnv;
    });

    it('should escape HTML in error messages', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/error');

      // Component that throws an XSS attempt
      function XssErrorPage() {
        throw new Error('<script>alert("xss")</script>');
      }

      const response = await renderToStream(match, request, {
        resolveComponent: async () => XssErrorPage,
        bootstrapScripts: [],
        onError: vi.fn(),
      });

      const html = await response.text();
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should handle non-Error objects thrown', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/error');

      // Component that throws a string
      function StringErrorPage() {
        throw 'string error'; // eslint-disable-line no-throw-literal
      }

      const onError = vi.fn();
      const response = await renderToStream(match, request, {
        resolveComponent: async () => StringErrorPage,
        bootstrapScripts: [],
        onError,
      });

      expect(response.status).toBe(500);
      const html = await response.text();
      expect(html).toContain('string error');
    });
  });

  describe('null component handling', () => {
    it('should return error when resolveComponent returns null', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/null');
      const onError = vi.fn();

      const response = await renderToStream(match, request, {
        resolveComponent: async () => null as unknown as React.ComponentType,
        bootstrapScripts: [],
        onError,
      });

      expect(response.status).toBe(500);
      expect(onError).toHaveBeenCalled();
      const errorArg = onError.mock.calls[0][0] as Error;
      expect(errorArg.message).toContain('Page component not found');
    });

    it('should return error when resolveComponent returns undefined', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/undefined');
      const onError = vi.fn();

      const response = await renderToStream(match, request, {
        resolveComponent: async () => undefined as unknown as React.ComponentType,
        bootstrapScripts: [],
        onError,
      });

      expect(response.status).toBe(500);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('default error handler', () => {
    it('should log errors to console', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/error');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await renderToStream(match, request, {
        resolveComponent: async () => ErrorPage,
        bootstrapScripts: [],
        // No onError provided, uses default
      });

      expect(consoleSpy).toHaveBeenCalledWith('[VeloxTS RSC Error]', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('streaming behavior', () => {
    it('should return response with streaming headers', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: ['/_build/client.js'],
      });

      expect(response.headers.get('Transfer-Encoding')).toBe('chunked');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should stream HTML content incrementally', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      const response = await renderToStream(match, request, {
        resolveComponent: async () => TestPage,
        bootstrapScripts: [],
      });

      // Read the stream
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      if (reader) {
        const chunks: Uint8Array[] = [];
        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          if (result.value) {
            chunks.push(result.value);
          }
        }

        expect(chunks.length).toBeGreaterThan(0);
        const allBytes: number[] = [];
        for (const chunk of chunks) {
          allBytes.push(...chunk);
        }
        const html = new TextDecoder().decode(new Uint8Array(allBytes));
        expect(html).toContain('Test Page');
      }
    });

    it('should handle stream cancellation gracefully', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/test');

      // Component that renders slowly to give time for cancellation
      async function SlowRenderPage() {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return <div>Slow content</div>;
      }

      const response = await renderToStream(match, request, {
        resolveComponent: async () => SlowRenderPage,
        bootstrapScripts: [],
      });

      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      if (reader) {
        // Start reading but cancel immediately
        await reader.cancel();

        // Stream should be cancelled without throwing
        // This tests the cancel() callback in nodeStreamToWebStream (lines 254-256)
        expect(true).toBe(true); // If we get here without error, the test passes
      }
    });
  });

  describe('dynamic import error handling', () => {
    it('should handle module not found errors', async () => {
      const match = createRouteMatch({
        route: {
          filePath: 'non-existent-module.tsx',
          pattern: '/missing',
          params: [],
          catchAll: false,
        },
      });
      const request = new Request('http://localhost:3030/missing');
      const onError = vi.fn();

      // Don't provide resolveComponent - let it try the default import
      const response = await renderToStream(match, request, {
        bootstrapScripts: [],
        onError,
      });

      expect(response.status).toBe(500);
      expect(onError).toHaveBeenCalled();
      const html = await response.text();
      expect(html).toContain('Server Render Error');
    });

    it('should handle module with no default export', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/no-default');
      const onError = vi.fn();

      // Simulate a module that resolves but has no default export
      const response = await renderToStream(match, request, {
        resolveComponent: async () => {
          // Simulate importing a module that exists but has no default export
          throw new Error('No default export found in ./app/pages/no-default');
        },
        bootstrapScripts: [],
        onError,
      });

      expect(response.status).toBe(500);
      expect(onError).toHaveBeenCalled();
      const errorArg = onError.mock.calls[0][0] as Error;
      expect(errorArg.message).toContain('No default export');
    });

    it('should include cause in import error', async () => {
      const match = createRouteMatch();
      const request = new Request('http://localhost:3030/import-error');
      const onError = vi.fn();

      const originalError = new Error('Module syntax error');
      const response = await renderToStream(match, request, {
        resolveComponent: async () => {
          throw new Error('Failed to import page component: ./app/pages/broken', {
            cause: originalError,
          });
        },
        bootstrapScripts: [],
        onError,
      });

      expect(response.status).toBe(500);
      const errorArg = onError.mock.calls[0][0] as Error;
      expect(errorArg.message).toContain('Failed to import');
      expect(errorArg.cause).toBe(originalError);
    });
  });
});
