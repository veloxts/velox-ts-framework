/**
 * Static File Serving Plugin
 *
 * Provides elegant static file serving with SPA support.
 * Zero-configuration defaults with powerful customization.
 *
 * @module plugins/static
 *
 * @example
 * ```typescript
 * // Zero-ceremony common case
 * await app.serveStatic('./public');
 *
 * // SPA with client-side routing
 * await app.serveStatic('./dist', { spa: true });
 *
 * // Full configuration
 * await app.serveStatic('./dist', {
 *   spa: true,
 *   prefix: '/assets',
 *   cache: { maxAge: '1y', immutable: true },
 *   exclude: ['/api', '/trpc'],
 * });
 * ```
 */

import { resolve } from 'node:path';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// ============================================================================
// Types
// ============================================================================

/**
 * Cache control configuration for served files
 */
export interface CacheControl {
  /**
   * How long browsers should cache files
   *
   * Accepts human-readable durations: '1d', '1y', '30m'
   * Or seconds as a number
   *
   * @default '1d'
   */
  maxAge?: string | number;

  /**
   * Mark as immutable (for fingerprinted assets)
   *
   * @default false
   */
  immutable?: boolean;
}

/**
 * Configuration for static file serving
 */
export interface StaticOptions {
  /**
   * Enable SPA mode for client-side routing
   *
   * @default false
   */
  spa?: boolean;

  /**
   * URL prefix for all static files
   *
   * @example '/assets' serves files at /assets/style.css
   * @default '/'
   */
  prefix?: string;

  /**
   * Cache control settings
   *
   * @default { maxAge: '1d' }
   */
  cache?: CacheControl;

  /**
   * URL prefixes to exclude from static serving
   *
   * @example ['/api', '/trpc']
   * @default []
   */
  exclude?: string[];

  /**
   * Directory index file
   *
   * @default 'index.html'
   */
  index?: string;
}

// ============================================================================
// Cache Duration Parser
// ============================================================================

/**
 * Parse human-readable duration to seconds
 *
 * @internal
 */
function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') {
    return duration;
  }

  const match = duration.match(/^(\d+)([smhdwy])$/);
  if (!match) {
    return 86400; // Default: 1 day
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
    y: 31536000,
  };

  return value * (multipliers[unit] ?? 86400);
}

/**
 * Build Cache-Control header value
 *
 * @internal
 */
function buildCacheControl(options: CacheControl): string {
  const maxAge = parseDuration(options.maxAge ?? '1d');
  const parts = [`public`, `max-age=${maxAge}`];

  if (options.immutable) {
    parts.push('immutable');
  }

  return parts.join(', ');
}

// ============================================================================
// Static File Handler
// ============================================================================

/**
 * Register static file serving on a Fastify instance
 *
 * Uses @fastify/static for efficient file serving with:
 * - Streaming support for large files
 * - ETag generation
 * - Last-Modified headers
 * - Range requests (resumable downloads)
 *
 * @param server - Fastify server instance
 * @param path - Directory containing static files
 * @param options - Serving configuration
 */
export async function registerStatic(
  server: FastifyInstance,
  path: string,
  options: StaticOptions = {}
): Promise<void> {
  const { spa = false, prefix = '/', cache = {}, exclude = [], index = 'index.html' } = options;

  // Resolve to absolute path
  const absoluteRoot = resolve(process.cwd(), path);

  // Dynamically import @fastify/static (optional peer dependency)
  let fastifyStatic: typeof import('@fastify/static').default;
  try {
    const module = await import('@fastify/static');
    fastifyStatic = module.default;
  } catch {
    throw new Error(
      'To serve static files, please install @fastify/static:\n\n  pnpm add @fastify/static'
    );
  }

  // Build cache control header
  const cacheControl = buildCacheControl(cache);

  // Register static plugin
  await server.register(fastifyStatic, {
    root: absoluteRoot,
    prefix,
    index,
    decorateReply: !server.hasDecorator('sendFile'),
    setHeaders: (res) => {
      res.setHeader('Cache-Control', cacheControl);
    },
  });

  // SPA fallback: serve index.html for non-file routes
  if (spa) {
    server.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip excluded paths (API routes, etc.)
      for (const excludePath of exclude) {
        if (request.url.startsWith(excludePath)) {
          return reply.status(404).send({
            error: 'NotFound',
            message: `Route ${request.method} ${request.url} not found`,
            statusCode: 404,
          });
        }
      }

      // Skip requests for files (have extensions)
      if (/\.\w+$/.test(request.url)) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'File not found',
          statusCode: 404,
        });
      }

      // Serve index.html for SPA routes
      return reply.sendFile(index, absoluteRoot);
    });
  }
}
