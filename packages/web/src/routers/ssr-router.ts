/**
 * SSR Router
 *
 * Handles server-side rendering of React Server Components.
 * This router is responsible for:
 * - Matching incoming requests to page components
 * - Resolving layouts
 * - Streaming RSC responses
 *
 * Returns an h3-compatible event handler for Vinxi integration.
 */

import type { RouteMatch } from '../types.js';
import { escapeHtml } from '../utils/html.js';

/**
 * h3 event type (minimal interface to avoid h3 dependency)
 */
export interface H3Event {
  node: {
    req: {
      method?: string;
      url?: string;
      headers: Record<string, string | string[] | undefined>;
    };
    res: {
      statusCode?: number;
      setHeader: (name: string, value: string | string[]) => void;
      end: (data?: unknown) => void;
      write: (chunk: unknown) => boolean;
      on: (event: string, listener: () => void) => void;
    };
  };
}

/**
 * H3 event handler type for Vinxi HTTP routers
 */
export type H3EventHandler = (event: H3Event) => Promise<void>;

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
 * Returns an h3-compatible event handler that Vinxi can use
 * for its HTTP router type.
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
export function createSsrRouter(options: SsrRouterOptions): H3EventHandler {
  const {
    resolveRoute,
    render,
    notFound = defaultNotFound,
    onError = defaultErrorHandler,
    logging,
  } = options;

  const shouldLog = logging ?? process.env.NODE_ENV !== 'production';

  return async function ssrHandler(event: H3Event): Promise<void> {
    const startTime = performance.now();
    const req = event.node.req;
    const res = event.node.res;

    // Build URL from request
    const protocol = 'http';
    const host = (req.headers.host as string) || 'localhost';
    const url = new URL(req.url || '/', `${protocol}://${host}`);

    // Create a Web Request from h3 event
    const request = new Request(url.toString(), {
      method: req.method || 'GET',
      headers: normalizeHeaders(req.headers),
    });

    try {
      // Resolve the route
      const match = await resolveRoute(url.pathname);

      if (!match) {
        if (shouldLog) {
          console.log(`[SSR] ${url.pathname} → 404 Not Found`);
        }
        const notFoundResponse = await notFound(request);
        await sendResponse(res, notFoundResponse);
        return;
      }

      // Render the matched route
      const response = await render(match, request);
      const elapsed = performance.now() - startTime;

      if (shouldLog) {
        console.log(`[SSR] ${url.pathname} → ${response.status} (${elapsed.toFixed(1)}ms)`);
      }

      await sendResponse(res, response);
    } catch (error) {
      const elapsed = performance.now() - startTime;

      if (shouldLog) {
        console.error(`[SSR] ${url.pathname} → ERROR (${elapsed.toFixed(1)}ms)`, error);
      }

      const errorResponse = await onError(
        error instanceof Error ? error : new Error(String(error)),
        request
      );
      await sendResponse(res, errorResponse);
    }
  };
}

/**
 * Normalizes h3 request headers to Headers object
 */
function normalizeHeaders(headers: Record<string, string | string[] | undefined>): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        for (const v of value) {
          result.append(key, v);
        }
      } else {
        result.set(key, value);
      }
    }
  }
  return result;
}

/**
 * Sends a Web Response through h3's response object
 */
async function sendResponse(res: H3Event['node']['res'], response: Response): Promise<void> {
  // Set status code
  res.statusCode = response.status;

  // Set headers
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  // Handle the response body
  if (!response.body) {
    res.end();
    return;
  }

  // Check if body is a ReadableStream (streaming response)
  const body = response.body;

  if (body instanceof ReadableStream) {
    // Stream the response
    const reader = body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }
    res.end();
  } else {
    // Non-streaming response - read all at once
    const text = await response.text();
    res.end(text);
  }
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
