/**
 * Request Logger Plugin
 *
 * Provides pretty-printed request/response logging for development.
 * Outputs colored, timestamped request logs with duration.
 *
 * @module plugins/request-logger
 *
 * @example
 * ```
 * 12:34:58  GET     /api/users 200 12ms
 * 12:35:01  POST    /api/users 201 45ms
 * 12:35:02  GET     /api/users/abc 404 2ms
 * ```
 *
 * Enable via environment variable:
 * ```
 * VELOX_REQUEST_LOGGING=true
 * ```
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

// ============================================================================
// Constants
// ============================================================================

/** ANSI escape codes for terminal colors */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
} as const;

/**
 * Padding width for HTTP method alignment.
 * Longest standard method is "OPTIONS" (7 characters).
 */
const HTTP_METHOD_PAD_WIDTH = 7;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color for HTTP status code.
 *
 * @param code - HTTP status code
 * @returns ANSI color escape code
 */
function getStatusColor(code: number): string {
  if (code >= 500) return COLORS.red;
  if (code >= 400) return COLORS.yellow;
  if (code >= 300) return COLORS.cyan;
  if (code >= 200) return COLORS.green;
  return COLORS.white;
}

/**
 * Format current time as HH:MM:SS.
 *
 * @returns Formatted time string
 */
function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format duration for display.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================================================
// Plugin Types
// ============================================================================

/**
 * Extended request type with start time tracking
 */
interface RequestWithTiming extends FastifyRequest {
  _veloxStartTime?: number;
}

// ============================================================================
// Plugin Implementation
// ============================================================================

/**
 * Request logger plugin registration function.
 *
 * Adds hooks for request timing and colored console output.
 * Only active when VELOX_REQUEST_LOGGING=true.
 *
 * @param server - Fastify instance
 */
async function requestLoggerPlugin(server: FastifyInstance): Promise<void> {
  // Skip if request logging not enabled via environment
  if (process.env.VELOX_REQUEST_LOGGING !== 'true') {
    return;
  }

  // Track request start time
  server.addHook('onRequest', async (request: FastifyRequest) => {
    (request as RequestWithTiming)._veloxStartTime = performance.now();
  });

  // Log on response with timing
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // Wrap in try-catch to ensure logging never breaks request handling
    try {
      const startTime = (request as RequestWithTiming)._veloxStartTime;
      const duration = startTime ? performance.now() - startTime : 0;

      const timestamp = formatTime();
      const method = request.method.padEnd(HTTP_METHOD_PAD_WIDTH);
      const url = request.url;
      const status = reply.statusCode;
      const color = getStatusColor(status);

      console.log(
        `${COLORS.dim}${timestamp}${COLORS.reset}  ${color}${method}${COLORS.reset} ${url} ${color}${status}${COLORS.reset} ${COLORS.dim}${formatDuration(duration)}${COLORS.reset}`
      );
    } catch {
      // Silently fail - logging should never affect application behavior
    }
  });
}

// ============================================================================
// Export
// ============================================================================

/**
 * Request logger plugin with Fastify plugin metadata.
 *
 * Provides pretty-printed request/response logging for development.
 * Enable via VELOX_REQUEST_LOGGING=true environment variable.
 */
export const requestLogger = fp(requestLoggerPlugin, {
  name: 'velox-request-logger',
  fastify: '5.x',
});
