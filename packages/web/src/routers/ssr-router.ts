/**
 * SSR Router
 *
 * Handles server-side rendering of React Server Components.
 * This router is responsible for:
 * - Matching incoming requests to page components
 * - Resolving layouts
 * - Streaming RSC responses
 */

import type { RouteMatch, VinxiHandler } from '../types.js';

/**
 * Options for creating the SSR router handler
 */
export interface SsrRouterOptions {
  /**
   * Function to resolve routes from file system
   */
  resolveRoute: (pathname: string) => Promise<RouteMatch | null>;

  /**
   * Function to render a matched route
   */
  render: (match: RouteMatch, request: Request) => Promise<Response>;

  /**
   * Handler for 404 responses
   */
  notFound?: (request: Request) => Promise<Response>;

  /**
   * Handler for errors during rendering
   */
  onError?: (error: Error, request: Request) => Promise<Response>;

  /**
   * Enable request logging
   * @default true in development
   */
  logging?: boolean;
}

/**
 * Creates the SSR router handler for Vinxi.
 *
 * @example
 * ```typescript
 * // src/entry.server.tsx
 * import { createSsrRouter, createFileRouter } from '@veloxts/web';
 * import { renderToStream } from '@veloxts/web/server';
 *
 * const fileRouter = createFileRouter({ pagesDir: 'app/pages' });
 *
 * export default createSsrRouter({
 *   resolveRoute: (path) => fileRouter.match(path),
 *   render: async (match, request) => {
 *     return renderToStream(match, request);
 *   },
 * });
 * ```
 */
export function createSsrRouter(options: SsrRouterOptions): VinxiHandler {
  const {
    resolveRoute,
    render,
    notFound = defaultNotFound,
    onError = defaultErrorHandler,
    logging,
  } = options;

  const shouldLog = logging ?? process.env.NODE_ENV !== 'production';

  return async function ssrHandler(request: Request): Promise<Response> {
    const startTime = performance.now();
    const url = new URL(request.url);

    try {
      // Resolve the route
      const match = await resolveRoute(url.pathname);

      if (!match) {
        if (shouldLog) {
          console.log(`[SSR] ${url.pathname} → 404 Not Found`);
        }
        return notFound(request);
      }

      // Render the matched route
      const response = await render(match, request);
      const elapsed = performance.now() - startTime;

      if (shouldLog) {
        console.log(`[SSR] ${url.pathname} → ${response.status} (${elapsed.toFixed(1)}ms)`);
      }

      return response;
    } catch (error) {
      const elapsed = performance.now() - startTime;

      if (shouldLog) {
        console.error(`[SSR] ${url.pathname} → ERROR (${elapsed.toFixed(1)}ms)`, error);
      }

      return onError(error instanceof Error ? error : new Error(String(error)), request);
    }
  };
}

/**
 * Default 404 handler
 */
async function defaultNotFound(_request: Request): Promise<Response> {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Not Found</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 4rem; margin: 0; color: #333; }
    p { color: #666; margin-top: 1rem; }
    a { color: #0070f3; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>Page not found</p>
    <p><a href="/">← Back to home</a></p>
  </div>
</body>
</html>`,
    {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    }
  );
}

/**
 * Default error handler
 */
async function defaultErrorHandler(error: Error, _request: Request): Promise<Response> {
  const isDev = process.env.NODE_ENV !== 'production';

  const errorDetails = isDev
    ? `<pre style="background:#f0f0f0;padding:1rem;overflow:auto;text-align:left;max-width:800px;margin:1rem auto;">${escapeHtml(error.stack || error.message)}</pre>`
    : '';

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>500 - Server Error</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 4rem; margin: 0; color: #e53e3e; }
    p { color: #666; margin-top: 1rem; }
    a { color: #0070f3; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>500</h1>
    <p>Something went wrong</p>
    ${errorDetails}
    <p><a href="/">← Back to home</a></p>
  </div>
</body>
</html>`,
    {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    }
  );
}

/**
 * Escapes HTML entities to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
