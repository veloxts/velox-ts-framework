/**
 * Client Router
 *
 * Handles serving client-side assets (JavaScript bundles, CSS, etc.)
 * This is primarily configured through Vinxi, but this module provides
 * utilities for customizing client asset handling.
 */

/**
 * Options for configuring the client router
 */
export interface ClientRouterOptions {
  /**
   * Base path for client assets
   * @default '/_build'
   */
  basePath?: string;

  /**
   * Enable immutable caching for hashed assets
   * @default true in production
   */
  immutableCache?: boolean;

  /**
   * Max age for cache headers in seconds
   * @default 31536000 (1 year) for immutable, 0 for mutable
   */
  maxAge?: number;
}

/**
 * Default client router configuration
 */
export const defaultClientConfig: Required<ClientRouterOptions> = {
  basePath: '/_build',
  immutableCache: process.env.NODE_ENV === 'production',
  maxAge: 31536000, // 1 year
};

/**
 * Generates cache control headers for client assets
 */
export function getCacheHeaders(
  filename: string,
  options: ClientRouterOptions = {}
): Record<string, string> {
  const config = { ...defaultClientConfig, ...options };

  // Check if file has content hash (immutable)
  const hasContentHash = /\.[a-f0-9]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|gif|webp|avif)$/i.test(
    filename
  );

  if (hasContentHash && config.immutableCache) {
    return {
      'Cache-Control': `public, max-age=${config.maxAge}, immutable`,
    };
  }

  return {
    'Cache-Control': 'no-cache',
  };
}

/**
 * Gets the content type for a given file extension
 */
export function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const contentTypes: Record<string, string> = {
    js: 'application/javascript',
    mjs: 'application/javascript',
    css: 'text/css',
    html: 'text/html',
    json: 'application/json',
    map: 'application/json',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    ico: 'image/x-icon',
  };

  return contentTypes[ext ?? ''] ?? 'application/octet-stream';
}
