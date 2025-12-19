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
});
