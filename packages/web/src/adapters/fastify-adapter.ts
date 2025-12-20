/**
 * Fastify → h3 Event Handler Adapter
 *
 * Converts between h3 event handlers and Fastify's internal request/reply.
 * This enables embedding Fastify handlers inside Vinxi's HTTP routers.
 */

import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';

import type { CreateApiHandlerOptions, VinxiHandler } from '../types.js';

/**
 * Default timeout for API requests (30 seconds)
 */
const DEFAULT_TIMEOUT = 30_000;

/**
 * Whether we're running in development mode.
 * Cached at module load to avoid repeated process.env access.
 *
 * Performance: Console logging in production paths adds ~2-4ms overhead.
 * By gating behind this check, we eliminate this overhead in production.
 */
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Node.js IncomingMessage with readable stream
 */
interface NodeRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  // Make it iterable for consuming the body stream
  [Symbol.asyncIterator]?: () => AsyncIterableIterator<Buffer>;
}

/**
 * h3 event type (minimal interface to avoid dependency)
 */
interface H3Event {
  node: {
    req: NodeRequest & {
    };
    res: {
      statusCode?: number;
      setHeader: (name: string, value: string | string[]) => void;
      end: (data?: unknown) => void;
    };
  };
}

/**
 * HTTP methods supported by Fastify inject
 */
type HTTPMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';

/**
 * Creates a Web API handler that delegates to a Fastify instance.
 *
 * This is the core adapter that enables VeloxTS API routes to work
 * through Vinxi's HTTP infrastructure.
 *
 * @example
 * ```typescript
 * import { createApp } from '@veloxts/core';
 * import { createApiHandler } from '@veloxts/web';
 * import { userProcedures } from './procedures/users';
 *
 * const app = await createApp();
 * // ... register routes
 *
 * export default createApiHandler({ app, basePath: '/api' });
 * ```
 */
export function createApiHandler(options: CreateApiHandlerOptions): VinxiHandler {
  const { app: appOrFactory, basePath = '/api', timeout = DEFAULT_TIMEOUT } = options;

  // Web API handler doesn't support factory functions (use createH3ApiHandler for that)
  if (typeof appOrFactory === 'function') {
    throw new Error(
      '[VeloxTS] createApiHandler does not support factory functions. ' +
        'Use createH3ApiHandler instead for lazy initialization.'
    );
  }

  const app = appOrFactory;

  // Validate that app is a valid Fastify instance
  if (!isFastifyInstance(app)) {
    throw new Error(
      '[VeloxTS] createApiHandler requires a valid Fastify instance. ' +
        'Ensure you pass the result of createApp() or Fastify().'
    );
  }

  // Ensure Fastify is ready
  let readyPromise: Promise<void> | null = null;

  async function ensureReady(): Promise<void> {
    if (readyPromise) return readyPromise;

    readyPromise = (async () => {
      // Only call ready if not already listening
      if (!app.server?.listening) {
        await app.ready();
      }
    })();

    return readyPromise;
  }

  return async function handler(request: Request): Promise<Response> {
    const startTime = performance.now();
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      // Ensure Fastify is initialized
      await ensureReady();

      // Convert Web API Request to Fastify inject options
      const injectOptions = await webRequestToInject(request, basePath);

      // Create timeout promise with cleanup capability
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
      });

      // Execute the request through Fastify's injection API
      const response = await Promise.race([app.inject(injectOptions), timeoutPromise]);

      // Clear timeout on success to prevent timer leak
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Convert Fastify response to Web API Response
      return injectToWebResponse(response);
    } catch (error) {
      // Clear timeout on error as well
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const elapsed = performance.now() - startTime;
      return createErrorResponse(error, elapsed);
    }
  };
}

/**
 * Converts a Web API Request to Fastify inject options
 */
async function webRequestToInject(request: Request, basePath: string): Promise<InjectOptions> {
  const url = new URL(request.url);

  // Strip the base path to get the relative URL for Fastify
  let path = url.pathname;
  if (basePath && path.startsWith(basePath)) {
    path = path.slice(basePath.length) || '/';
  }

  // Reconstruct URL with query string
  const fullPath = path + url.search;

  // Convert headers (excluding hop-by-hop headers)
  const headers: Record<string, string> = {};
  const hopByHopHeaders = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ]);

  request.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      headers[key] = value;
    }
  });

  // Handle request body
  let payload: string | Buffer | undefined;
  if (request.body && !['GET', 'HEAD'].includes(request.method)) {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      payload = await request.text();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      payload = await request.text();
    } else if (contentType.includes('multipart/form-data')) {
      // For multipart, we pass the raw buffer
      payload = Buffer.from(await request.arrayBuffer());
    } else {
      // Default to text for other content types
      payload = await request.text();
    }
  }

  return {
    method: request.method as HTTPMethod,
    url: fullPath,
    headers,
    payload,
  };
}

/**
 * Converts a Fastify inject response to a Web API Response
 */
function injectToWebResponse(response: LightMyRequestResponse): Response {
  // Convert headers
  const headers = new Headers();

  for (const [key, value] of Object.entries(response.headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        for (const v of value) {
          headers.append(key, String(v));
        }
      } else {
        headers.set(key, String(value));
      }
    }
  }

  // Determine if we should use raw payload or body
  const contentType = headers.get('content-type') || '';
  const isText =
    contentType.includes('text/') ||
    contentType.includes('application/json') ||
    contentType.includes('application/xml');

  // Use text body for text types, raw payload (converted to Uint8Array) for binary
  const body: BodyInit = isText ? response.body : new Uint8Array(response.rawPayload);

  return new Response(body, {
    status: response.statusCode,
    headers,
  });
}

/**
 * Creates an error response for failed requests
 */
function createErrorResponse(error: unknown, elapsed: number): Response {
  const isTimeout = error instanceof Error && error.message.includes('timeout');
  const statusCode = isTimeout ? 504 : 500;
  const message = error instanceof Error ? error.message : 'Internal Server Error';

  // Only log errors in development to avoid performance overhead in production
  if (isDev) {
    console.error('[VeloxTS] API handler error:', {
      error: message,
      elapsed: `${elapsed.toFixed(2)}ms`,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return new Response(
    JSON.stringify({
      error: message,
      statusCode,
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Reads the request body from a Node.js IncomingMessage.
 * Returns the body as a string for text content types, or Buffer for binary.
 */
async function readRequestBody(
  req: NodeRequest,
  contentType: string | undefined
): Promise<string | Buffer | undefined> {
  // Skip body for GET/HEAD requests
  const method = req.method?.toUpperCase();
  if (!method || method === 'GET' || method === 'HEAD') {
    return undefined;
  }

  // No async iterator means no body to read
  if (!req[Symbol.asyncIterator]) {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const buffer = Buffer.concat(chunks);

  // Return as string for text content types, buffer for binary
  const isText =
    !contentType ||
    contentType.includes('application/json') ||
    contentType.includes('text/') ||
    contentType.includes('application/x-www-form-urlencoded');

  return isText ? buffer.toString('utf-8') : buffer;
}

/**
 * Global singleton cache for Fastify instances.
 * This prevents duplicate initialization during HMR reloads in Vinxi dev mode.
 * Uses globalThis to persist across module reloads.
 */
const CACHE_KEY = Symbol.for('@veloxts/web:fastify-instances');

interface AppCache {
  instance: FastifyInstance | null;
  promise: Promise<FastifyInstance> | null;
}

function getGlobalCache(): Map<string, AppCache> {
  if (!(CACHE_KEY in globalThis)) {
    (globalThis as Record<symbol, unknown>)[CACHE_KEY] = new Map<string, AppCache>();
  }
  return (globalThis as Record<symbol, Map<string, AppCache>>)[CACHE_KEY];
}

/**
 * Creates an h3 event handler that delegates to a Fastify instance.
 *
 * This is the recommended adapter for Vinxi HTTP routers, as Vinxi
 * expects h3 event handlers as the default export.
 *
 * Supports both eager and lazy initialization:
 * - Eager: Pass a FastifyInstance directly (must be already initialized)
 * - Lazy: Pass a factory function that returns Promise<FastifyInstance>
 *
 * @example Eager initialization
 * ```typescript
 * const app = await createApp();
 * await app.register(...);
 * export default createH3ApiHandler({ app, basePath: '/api' });
 * ```
 *
 * @example Lazy initialization (recommended for Vinxi)
 * ```typescript
 * export default createH3ApiHandler({
 *   app: async () => {
 *     const app = await createApp();
 *     await app.register(...);
 *     return app;
 *   },
 *   basePath: '/api',
 * });
 * ```
 */
export function createH3ApiHandler(options: CreateApiHandlerOptions) {
  const { app: appOrFactory, basePath = '/api', timeout = DEFAULT_TIMEOUT } = options;

  // Create a stable cache key for this handler
  // Use basePath as the key since there's typically one API handler per app
  const cacheKey = `api:${basePath}`;
  const cache = getGlobalCache();

  // Get or create cache entry for this handler
  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, {
      instance: null,
      promise: null,
    });
  }

  const singleton = cache.get(cacheKey)!;

  async function getApp(): Promise<FastifyInstance> {
    // If already resolved, return it
    if (singleton.instance) {
      if (isDev) {
        console.log('[VeloxTS] Returning cached Fastify instance for', cacheKey);
      }
      return singleton.instance;
    }

    // If initialization in progress, wait for it
    if (singleton.promise) {
      if (isDev) {
        console.log('[VeloxTS] Waiting for Fastify initialization to complete for', cacheKey);
      }
      return singleton.promise;
    }

    if (isDev) {
      console.log('[VeloxTS] Creating new Fastify instance for', cacheKey);
    }

    // Determine if we have a factory or an instance
    if (typeof appOrFactory === 'function') {
      // Factory function - lazy initialize
      singleton.promise = (async () => {
        const app = await appOrFactory();

        if (!isFastifyInstance(app)) {
          throw new Error(
            '[VeloxTS] createH3ApiHandler factory must return a valid Fastify instance.'
          );
        }

        // Ensure Fastify is ready
        if (!app.server?.listening) {
          await app.ready();
        }

        singleton.instance = app;
        if (isDev) {
          console.log('[VeloxTS] Fastify instance initialized and cached for', cacheKey);
        }
        return app;
      })();

      return singleton.promise;
    }

    // Direct instance - validate and use
    if (!isFastifyInstance(appOrFactory)) {
      throw new Error(
        '[VeloxTS] createH3ApiHandler requires a valid Fastify instance or factory function.'
      );
    }

    // Ensure instance is ready
    if (!appOrFactory.server?.listening) {
      await appOrFactory.ready();
    }

    singleton.instance = appOrFactory;
    return singleton.instance;
  }

  // Return h3 event handler
  return async function handler(event: H3Event) {
    const startTime = performance.now();
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      // Lazy-initialize Fastify app on first request
      const app = await getApp();

      // Extract request details from h3 event
      const req = event.node.req;

      // Build full URL
      const url = req.url || '/';

      // Strip the base path to get the relative URL for Fastify
      let path = url;
      const queryIndex = path.indexOf('?');
      const pathname = queryIndex >= 0 ? path.slice(0, queryIndex) : path;
      const search = queryIndex >= 0 ? path.slice(queryIndex) : '';

      let strippedPath = pathname;
      if (basePath && pathname.startsWith(basePath)) {
        strippedPath = pathname.slice(basePath.length) || '/';
      }

      // Reconstruct URL with query string
      const fullPath = strippedPath + search;

      // Convert headers (excluding hop-by-hop headers)
      const headers: Record<string, string> = {};
      const hopByHopHeaders = new Set([
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'transfer-encoding',
        'upgrade',
      ]);

      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined && !hopByHopHeaders.has(key.toLowerCase())) {
          headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
        }
      }

      // Read request body for POST/PUT/PATCH/DELETE
      const contentType = headers['content-type'];
      const payload = await readRequestBody(req, contentType);

      // Create inject options
      const injectOptions: InjectOptions = {
        method: (req.method || 'GET') as HTTPMethod,
        url: fullPath,
        headers,
        payload,
      };

      // Create timeout promise with cleanup capability
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
      });

      // Execute the request through Fastify's injection API
      const response = await Promise.race([app.inject(injectOptions), timeoutPromise]);

      // Clear timeout on success to prevent timer leak
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Set response status and headers
      const responseObj = event.node.res;
      responseObj.statusCode = response.statusCode;

      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined) {
          // Convert number headers to strings (e.g., content-length)
          const headerValue = typeof value === 'number' ? String(value) : value;
          responseObj.setHeader(key, headerValue);
        }
      }

      // Send response body
      responseObj.end(response.body);
    } catch (error) {
      // Clear timeout on error as well
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const elapsed = performance.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes('timeout');
      const statusCode = isTimeout ? 504 : 500;
      const message = error instanceof Error ? error.message : 'Internal Server Error';

      if (isDev) {
        console.error('[VeloxTS] API handler error:', {
          error: message,
          elapsed: `${elapsed.toFixed(2)}ms`,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }

      const responseObj = event.node.res;
      responseObj.statusCode = statusCode;
      responseObj.setHeader('Content-Type', 'application/json');
      responseObj.end(
        JSON.stringify({
          error: message,
          statusCode,
          timestamp: new Date().toISOString(),
        })
      );
    }
  };
}

/**
 * Type guard for checking if an object is a valid Fastify instance
 */
export function isFastifyInstance(obj: unknown): obj is FastifyInstance {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'inject' in obj &&
    typeof (obj as FastifyInstance).inject === 'function' &&
    'ready' in obj &&
    typeof (obj as FastifyInstance).ready === 'function'
  );
}
