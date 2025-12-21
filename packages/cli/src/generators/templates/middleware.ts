/**
 * Middleware Template
 *
 * Generates middleware files for VeloxTS applications.
 */

import type { ProjectContext, TemplateContext, TemplateFunction } from '../types.js';

// ============================================================================
// Template Options
// ============================================================================

export interface MiddlewareOptions {
  /** Generate request timing middleware */
  timing: boolean;
  /** Generate logging middleware */
  logging: boolean;
  /** Generate rate limiting middleware */
  rateLimit: boolean;
  /** Generate CORS middleware */
  cors: boolean;
}

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the path for a middleware file
 */
export function getMiddlewarePath(entityName: string, _project: ProjectContext): string {
  return `src/middleware/${entityName.toLowerCase()}.ts`;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate timing middleware
 */
function generateTimingMiddleware(ctx: TemplateContext<MiddlewareOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Timing Middleware
 *
 * Tracks request duration and adds timing headers.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    startTime: number;
  }
}

/**
 * Request timing middleware
 *
 * Adds X-Response-Time header with request duration in milliseconds.
 */
async function ${entity.camel}Middleware(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.startTime = performance.now();
  });

  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = performance.now() - request.startTime;
    reply.header('X-Response-Time', \`\${duration.toFixed(2)}ms\`);
  });
}

export default fp(${entity.camel}Middleware, {
  name: '${entity.kebab}-middleware',
  fastify: '5.x',
});
`;
}

/**
 * Generate logging middleware
 */
function generateLoggingMiddleware(ctx: TemplateContext<MiddlewareOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Logging Middleware
 *
 * Structured request/response logging with context.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

interface LogContext {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Structured logging middleware
 */
async function ${entity.camel}Middleware(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const ctx: LogContext = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };

    request.log.info(ctx, 'Incoming request');
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    request.log.info(
      {
        requestId: request.id,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'Request completed'
    );
  });

  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    request.log.error(
      {
        requestId: request.id,
        error: error.message,
        stack: error.stack,
      },
      'Request error'
    );
  });
}

export default fp(${entity.camel}Middleware, {
  name: '${entity.kebab}-middleware',
  fastify: '5.x',
});
`;
}

/**
 * Generate rate limiting middleware
 */
function generateRateLimitMiddleware(ctx: TemplateContext<MiddlewareOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Rate Limiting Middleware
 *
 * Token bucket rate limiting with configurable limits.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

interface RateLimitOptions {
  /** Maximum requests per window */
  max: number;
  /** Time window in milliseconds */
  window: number;
  /** Custom key generator (default: IP address) */
  keyGenerator?: (request: FastifyRequest) => string;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  max: 100,
  window: 60 * 1000, // 1 minute
};

// In-memory store (use Redis in production)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limiting middleware
 */
async function ${entity.camel}Middleware(
  fastify: FastifyInstance,
  options: Partial<RateLimitOptions> = {}
): Promise<void> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const keyGenerator = config.keyGenerator ?? ((req) => req.ip);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = keyGenerator(request);
    const now = Date.now();

    let record = requestCounts.get(key);

    // Reset if window expired
    if (!record || now >= record.resetAt) {
      record = { count: 0, resetAt: now + config.window };
      requestCounts.set(key, record);
    }

    record.count++;

    // Add rate limit headers
    reply.header('X-RateLimit-Limit', config.max);
    reply.header('X-RateLimit-Remaining', Math.max(0, config.max - record.count));
    reply.header('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > config.max) {
      reply.header('Retry-After', Math.ceil((record.resetAt - now) / 1000));
      reply.status(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
    }
  });

  // Cleanup expired entries periodically
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requestCounts) {
      if (now >= record.resetAt) {
        requestCounts.delete(key);
      }
    }
  }, config.window);

  fastify.addHook('onClose', async () => {
    clearInterval(cleanup);
  });
}

export default fp(${entity.camel}Middleware, {
  name: '${entity.kebab}-middleware',
  fastify: '5.x',
});
`;
}

/**
 * Generate CORS middleware
 */
function generateCorsMiddleware(ctx: TemplateContext<MiddlewareOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} CORS Middleware
 *
 * Cross-Origin Resource Sharing configuration.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

interface CorsOptions {
  /** Allowed origins (string, array, or function) */
  origin: string | string[] | ((origin: string) => boolean);
  /** Allowed HTTP methods */
  methods: string[];
  /** Allowed headers */
  allowedHeaders: string[];
  /** Exposed headers */
  exposedHeaders: string[];
  /** Allow credentials */
  credentials: boolean;
  /** Preflight cache duration in seconds */
  maxAge: number;
}

const DEFAULT_OPTIONS: CorsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id', 'X-Response-Time'],
  credentials: false,
  maxAge: 86400, // 24 hours
};

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string, allowed: CorsOptions['origin']): boolean {
  if (allowed === '*') return true;
  if (typeof allowed === 'string') return origin === allowed;
  if (Array.isArray(allowed)) return allowed.includes(origin);
  if (typeof allowed === 'function') return allowed(origin);
  return false;
}

/**
 * CORS middleware
 */
async function ${entity.camel}Middleware(
  fastify: FastifyInstance,
  options: Partial<CorsOptions> = {}
): Promise<void> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin ?? '';

    if (origin && isOriginAllowed(origin, config.origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
    } else if (config.origin === '*') {
      reply.header('Access-Control-Allow-Origin', '*');
    }

    if (config.credentials) {
      reply.header('Access-Control-Allow-Credentials', 'true');
    }

    reply.header('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));

    // Handle preflight
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Methods', config.methods.join(', '));
      reply.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
      reply.header('Access-Control-Max-Age', config.maxAge.toString());
      reply.status(204).send();
    }
  });
}

export default fp(${entity.camel}Middleware, {
  name: '${entity.kebab}-middleware',
  fastify: '5.x',
});
`;
}

/**
 * Generate simple middleware template
 */
function generateSimpleMiddleware(ctx: TemplateContext<MiddlewareOptions>): string {
  const { entity } = ctx;

  return `/**
 * ${entity.pascal} Middleware
 *
 * Custom middleware for VeloxTS application.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

/**
 * ${entity.pascal} middleware options
 */
interface ${entity.pascal}MiddlewareOptions {
  // TODO: Add configuration options
}

/**
 * ${entity.pascal} middleware
 *
 * Add your custom middleware logic here.
 */
async function ${entity.camel}Middleware(
  fastify: FastifyInstance,
  _options: ${entity.pascal}MiddlewareOptions = {}
): Promise<void> {
  // Run before each request
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Add pre-request logic
    // Example: request.customProperty = 'value';
  });

  // Run after response is sent
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Add post-response logic
    // Example: Log response metrics
  });

  // Run when an error occurs
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    // TODO: Add error handling logic
    // Example: Report to error tracking service
  });

  // Decorate fastify instance if needed
  // fastify.decorate('${entity.camel}', { /* ... */ });
}

export default fp(${entity.camel}Middleware, {
  name: '${entity.kebab}-middleware',
  fastify: '5.x',
});
`;
}

// ============================================================================
// Main Template
// ============================================================================

/**
 * Middleware template function
 */
export const middlewareTemplate: TemplateFunction<MiddlewareOptions> = (ctx) => {
  if (ctx.options.timing) {
    return generateTimingMiddleware(ctx);
  }
  if (ctx.options.logging) {
    return generateLoggingMiddleware(ctx);
  }
  if (ctx.options.rateLimit) {
    return generateRateLimitMiddleware(ctx);
  }
  if (ctx.options.cors) {
    return generateCorsMiddleware(ctx);
  }
  return generateSimpleMiddleware(ctx);
};

// ============================================================================
// Post-generation Instructions
// ============================================================================

export function getMiddlewareInstructions(entityName: string, options: MiddlewareOptions): string {
  const lines = [`Your ${entityName} middleware has been created.`, '', 'Next steps:'];

  lines.push('  1. Register the middleware in your app:');
  lines.push(`     await app.register(import('./middleware/${entityName.toLowerCase()}.js'));`);

  if (options.timing) {
    lines.push('  2. Access timing via X-Response-Time header');
  } else if (options.logging) {
    lines.push('  2. Configure your logger for structured output');
  } else if (options.rateLimit) {
    lines.push('  2. Adjust rate limits for your use case');
    lines.push('  3. Consider using Redis for distributed rate limiting');
  } else if (options.cors) {
    lines.push('  2. Configure allowed origins for your environment');
  } else {
    lines.push('  2. Implement your middleware logic in the hooks');
  }

  return lines.join('\n');
}
