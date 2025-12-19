/**
 * Fastify → Web API Adapter
 *
 * Converts between Web API Request/Response and Fastify's internal request/reply.
 * This enables embedding Fastify handlers inside Vinxi's HTTP routers.
 */

import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';

import type { CreateApiHandlerOptions, VinxiHandler } from '../types.js';

/**
 * Default timeout for API requests (30 seconds)
 */
const DEFAULT_TIMEOUT = 30_000;

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
  const { app, basePath = '/api', timeout = DEFAULT_TIMEOUT } = options;

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

    try {
      // Ensure Fastify is initialized
      await ensureReady();

      // Convert Web API Request to Fastify inject options
      const injectOptions = await webRequestToInject(request, basePath);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
      });

      // Execute the request through Fastify's injection API
      const response = await Promise.race([app.inject(injectOptions), timeoutPromise]);

      // Convert Fastify response to Web API Response
      return injectToWebResponse(response);
    } catch (error) {
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

  console.error('[VeloxTS] API handler error:', {
    error: message,
    elapsed: `${elapsed.toFixed(2)}ms`,
    stack: error instanceof Error ? error.stack : undefined,
  });

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
