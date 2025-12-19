/**
 * SSR Handler Factory
 *
 * Creates a server-side rendering handler for React Server Components.
 * This is the entry point for SSR in a Vinxi application.
 */

import type { RouteMatch, VinxiHandler } from '../types.js';
import { escapeHtml } from '../utils/html.js';
import type { RenderToStreamOptions } from './server-renderer.js';
import { renderToStream } from './server-renderer.js';

/**
 * Options for the SSR handler
 */
export interface SsrHandlerOptions {
  /**
   * Enable streaming SSR
   * @default true
   */
  streaming?: boolean;

  /**
   * Timeout for shell rendering in milliseconds
   * @default 5000
   */
  shellTimeout?: number;

  /**
   * Directory containing page components
   * @default 'app/pages'
   */
  pagesDir?: string;

  /**
   * Bootstrap scripts to inject
   * @default []
   */
  bootstrapScripts?: string[];

  /**
   * Custom error handler
   */
  onError?: (error: Error, errorInfo?: unknown) => void;
}

/**
 * Creates an SSR handler for Vinxi.
 *
 * This factory function creates a handler that:
 * 1. Parses the incoming request URL
 * 2. Matches it against the file-based routes
 * 3. Renders the matched page component as HTML
 * 4. Returns a streaming response
 *
 * **Note:** This handler uses a simplified route matching that does NOT extract
 * dynamic route parameters from URL paths. For production use with dynamic routes
 * like `/users/[id]`, use `createSsrRouter` with `createFileRouter` instead:
 *
 * @example
 * ```typescript
 * // Simple usage (static routes only)
 * import { createSsrHandler } from '@veloxts/web';
 *
 * export default createSsrHandler({
 *   streaming: true,
 *   shellTimeout: 5000,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Recommended: Full dynamic route support
 * import { createSsrRouter, createFileRouter, renderToStream } from '@veloxts/web';
 *
 * const fileRouter = createFileRouter({ pagesDir: 'app/pages' });
 *
 * export default createSsrRouter({
 *   resolveRoute: (path) => fileRouter.match(path),
 *   render: (match, request) => renderToStream(match, request),
 * });
 * ```
 */
export function createSsrHandler(options: SsrHandlerOptions = {}): VinxiHandler {
  const {
    // streaming option kept for API compatibility but currently always streams
    streaming: _streaming = true,
    shellTimeout = 5000,
    pagesDir = 'app/pages',
    bootstrapScripts = [],
    onError,
  } = options;

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Create a route match from the request
    // In a real implementation, this would use the file router
    // For now, we create a simple match based on the pathname
    const match = createRouteMatch(pathname, url.searchParams, pagesDir);

    // Build render options
    const renderOptions: RenderToStreamOptions = {
      shellTimeout,
      bootstrapScripts,
      onError,
    };

    try {
      // Render the page to a streaming response
      return await renderToStream(match, request, renderOptions);
    } catch (error) {
      // Handle rendering errors
      if (onError && error instanceof Error) {
        onError(error);
      }

      // Return a 500 error response
      return new Response(
        createErrorHtml(error instanceof Error ? error : new Error(String(error))),
        {
          status: 500,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
          },
        }
      );
    }
  };
}

/**
 * Creates a route match from a pathname.
 *
 * **Important Limitation:** This is a simplified fallback implementation that
 * does NOT extract dynamic route parameters from URL path segments.
 *
 * For example, given a request to `/users/123` and a page at `users/[id].tsx`:
 * - This function will NOT extract `{ id: '123' }` from the path
 * - It only includes query parameters from the URL search params
 *
 * **Recommended Usage:**
 * For proper dynamic route param extraction, use `createSsrRouter` with
 * `createFileRouter` instead of `createSsrHandler`:
 *
 * ```typescript
 * import { createSsrRouter, createFileRouter } from '@veloxts/web';
 *
 * const fileRouter = createFileRouter({ pagesDir: 'app/pages' });
 *
 * export default createSsrRouter({
 *   resolveRoute: (path) => fileRouter.match(path),
 *   render: (match, request) => renderToStream(match, request),
 * });
 * ```
 *
 * The `FileRouter` provides full dynamic segment matching including:
 * - Dynamic segments: `[id]`, `[slug]`
 * - Catch-all segments: `[...path]`
 * - Optional catch-all: `[[...path]]`
 *
 * @internal This is a simplified fallback - use FileRouter for production
 */
function createRouteMatch(
  pathname: string,
  searchParams: URLSearchParams,
  pagesDir: string
): RouteMatch {
  // Normalize pathname
  const normalizedPath = pathname === '/' ? '/index' : pathname;

  // Convert pathname to file path
  // Note: This assumes direct mapping without dynamic segment matching
  // e.g., /users/123 -> users/123.tsx (NOT users/[id].tsx)
  const segments = normalizedPath.split('/').filter(Boolean);
  const filePath = segments.length === 0 ? 'index.tsx' : `${segments.join('/')}.tsx`;

  // Extract params from query string only
  // Dynamic path params (e.g., [id]) are NOT extracted by this simplified function
  // Use FileRouter.match() for full dynamic route parameter extraction
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return {
    route: {
      filePath: `${pagesDir}/${filePath}`,
      pattern: pathname,
      params: [],
      catchAll: false,
    },
    params,
  };
}

/**
 * Creates an HTML error page for server errors
 */
function createErrorHtml(error: Error): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const errorMessage = escapeHtml(error.message);
  const errorStack = isDev ? escapeHtml(error.stack ?? '') : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 40px;
      background: #1a1a1a;
      color: #fff;
    }
    h1 { color: #ff6b6b; margin-bottom: 20px; }
    .error-container {
      max-width: 800px;
      margin: 0 auto;
    }
    .error-message {
      background: #2d2d2d;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #ff6b6b;
    }
    .error-stack {
      margin-top: 20px;
      padding: 20px;
      background: #252525;
      border-radius: 8px;
      overflow-x: auto;
      font-family: monospace;
      font-size: 14px;
      white-space: pre-wrap;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>Server Error</h1>
    <div class="error-message">
      <p>${errorMessage}</p>
    </div>
    ${isDev && errorStack ? `<pre class="error-stack">${errorStack}</pre>` : ''}
  </div>
</body>
</html>`;
}
