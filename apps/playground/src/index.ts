/**
 * VeloxTS Playground Application
 *
 * Development testing application for validating framework features
 * and demonstrating usage patterns.
 *
 * Directory Structure:
 * ```
 * src/
 * ├── config/          # Application configuration
 * ├── database/        # Database client and migrations
 * ├── procedures/      # API procedures (business logic)
 * ├── schemas/         # Zod validation schemas
 * └── index.ts         # Application entry point
 * ```
 */

import 'dotenv/config';

import path from 'node:path';

import fastifyStatic from '@fastify/static';
import { authPlugin } from '@veloxts/auth';
import { VELOX_VERSION, veloxApp } from '@veloxts/core';
import { databasePlugin } from '@veloxts/orm';
import { getRouteSummary, registerRestRoutes, registerTRPCPlugin } from '@veloxts/router';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { authConfig, config } from './config/index.js';
import { createMockPrismaClient, prisma } from './database/index.js';
import { authProcedures, healthProcedures, userProcedures } from './procedures/index.js';
import { appRouter } from './trpc/index.js';

// ============================================================================
// Database Mode
// ============================================================================

/**
 * Set USE_MOCK_DB=true to use in-memory mock database
 * Set USE_MOCK_DB=false (or omit) to use real Prisma/SQLite database
 */
const USE_MOCK_DB = process.env.USE_MOCK_DB === 'true';

// ============================================================================
// CSRF Protection Configuration
// ============================================================================

/**
 * Paths excluded from CSRF protection
 * - Health check endpoints
 * - Static assets
 */
const CSRF_EXCLUDED_PATHS = ['/api/health', '/api/health/ready', '/api/health/live', '/trpc'];

/**
 * HTTP methods that require CSRF protection
 */
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Check if CSRF protection should be enforced
 * Enable with ENFORCE_CSRF=true in production
 */
const ENFORCE_CSRF = process.env.ENFORCE_CSRF === 'true';

// ============================================================================
// Error Sanitization (Security Phase 3.5)
// ============================================================================

/**
 * Prisma error codes that reveal database implementation details
 */
const PRISMA_ERROR_CODES: Record<string, string> = {
  P2002: 'A record with this value already exists',
  P2003: 'Related record not found',
  P2025: 'Record not found',
  P2014: 'Invalid relation',
  P2000: 'Invalid value provided',
  P2001: 'Record not found',
  P2015: 'Related record not found',
  P2016: 'Query interpretation error',
  P2021: 'Table does not exist',
  P2022: 'Column does not exist',
};

/**
 * Map of status codes to generic error messages
 */
const STATUS_CODE_MESSAGES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/**
 * Sanitizes error for production responses
 *
 * - Strips internal error details
 * - Converts Prisma errors to user-friendly messages
 * - Removes stack traces
 * - Removes guard names
 */
function sanitizeErrorForProduction(
  error: Error & { statusCode?: number; code?: string; guardName?: string },
  statusCode: number
): { error: string; message: string } {
  // Check for Prisma error codes
  const prismaCode = error.code?.match(/^P\d{4}$/);
  if (prismaCode && error.code && PRISMA_ERROR_CODES[error.code]) {
    return {
      error: 'DATABASE_ERROR',
      message: PRISMA_ERROR_CODES[error.code],
    };
  }

  // Allow through safe, user-facing error codes
  const safeErrorCodes = new Set([
    'INVALID_CREDENTIALS',
    'RATE_LIMIT_EXCEEDED',
    'TOKEN_EXPIRED',
    'TOKEN_REVOKED',
    'NOT_AUTHENTICATED',
    'REGISTRATION_FAILED',
    'VALIDATION_ERROR',
    'INVALID_REFRESH_TOKEN',
    'TOKEN_REUSE_DETECTED',
  ]);

  if (error.code && safeErrorCodes.has(error.code)) {
    return {
      error: error.code,
      message: error.message,
    };
  }

  // Generic error responses based on status code
  return {
    error: STATUS_CODE_MESSAGES[statusCode] ? 'ERROR' : 'INTERNAL_ERROR',
    message: STATUS_CODE_MESSAGES[statusCode] ?? 'An unexpected error occurred',
  };
}

// ============================================================================
// Application Bootstrap
// ============================================================================

/**
 * Creates and configures the VeloxTS application
 */
async function createApp() {
  // Create the VeloxTS app with configuration
  const app = await veloxApp({
    port: config.port,
    host: config.host,
    logger: config.logger,
  });

  // Register database plugin
  // Use mock database for testing or real Prisma for development
  const dbClient = USE_MOCK_DB ? createMockPrismaClient() : prisma;
  await app.register(databasePlugin({ client: dbClient }));

  console.log(`[Database] Using ${USE_MOCK_DB ? 'mock in-memory' : 'Prisma SQLite'} database`);

  // Register auth plugin
  await app.register(authPlugin(authConfig));
  console.log('[Auth] JWT authentication enabled');

  // ============================================================================
  // CSRF Protection Hook
  // ============================================================================
  //
  // For JWT-based APIs, CSRF protection via custom header requirement is the
  // recommended approach. Cross-origin requests with custom headers require
  // CORS preflight, which browsers won't allow without explicit server consent.
  //
  // This protection requires:
  // - X-Requested-With: XMLHttpRequest header on all state-changing requests
  // - Or: Content-Type: application/json header (which also triggers preflight)
  //
  // Enable with ENFORCE_CSRF=true for production deployments.
  // ============================================================================
  if (ENFORCE_CSRF) {
    app.server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      // Only check state-changing methods
      if (!CSRF_PROTECTED_METHODS.includes(request.method)) {
        return;
      }

      // Skip excluded paths
      const path = request.url.split('?')[0];
      if (CSRF_EXCLUDED_PATHS.some((excluded) => path.startsWith(excluded))) {
        return;
      }

      // Skip if Authorization header is present (API clients with JWT)
      // JWT tokens provide their own security against CSRF since they can't
      // be automatically sent by browsers like cookies
      if (request.headers.authorization) {
        return;
      }

      // For non-authenticated requests (like login/register), require custom header
      const xRequestedWith = request.headers['x-requested-with'];
      const contentType = request.headers['content-type'];

      // Check for XMLHttpRequest header or JSON content type
      // Both trigger CORS preflight for cross-origin requests
      const hasXhr = xRequestedWith === 'XMLHttpRequest';
      const hasJsonContent = contentType?.includes('application/json');

      if (!hasXhr && !hasJsonContent) {
        reply.code(403).send({
          error: 'CSRF_PROTECTION',
          message:
            'Cross-site request blocked. Include X-Requested-With: XMLHttpRequest header or use Content-Type: application/json.',
        });
        return;
      }
    });

    console.log('[Security] CSRF protection enabled via custom header requirement');
  } else if (config.env === 'production') {
    console.warn(
      '[Security] WARNING: CSRF protection is disabled. Set ENFORCE_CSRF=true for production.'
    );
  }

  // ============================================================================
  // Global Error Handler (Security Phase 3.5)
  // ============================================================================
  //
  // Sanitizes error responses to prevent information disclosure:
  // - Strips stack traces in production
  // - Sanitizes Prisma error messages
  // - Removes internal error codes and guard names
  // - Logs full errors server-side for debugging
  // ============================================================================
  app.server.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
    const isProduction = config.env === 'production';

    // Extract error properties safely
    const err = error as Error & {
      statusCode?: number;
      code?: string;
      guardName?: string;
      validation?: unknown;
    };

    const statusCode = err.statusCode ?? 500;

    // Log full error server-side (always, for debugging)
    request.log.error(
      {
        error: err.message,
        code: err.code,
        stack: err.stack,
        url: request.url,
        method: request.method,
      },
      'Request error'
    );

    // Build client-safe error response
    if (isProduction) {
      // Production: Minimal error information
      const sanitizedError = sanitizeErrorForProduction(err, statusCode);
      return reply.status(statusCode).send(sanitizedError);
    }

    // Development: Include more details for debugging
    return reply.status(statusCode).send({
      error: err.code ?? 'ERROR',
      message: err.message,
      ...(err.guardName ? { guardName: err.guardName } : {}),
      ...(err.validation ? { validation: err.validation } : {}),
      // Include stack in development only
      stack: err.stack?.split('\n').slice(0, 5),
    });
  });

  console.log(
    `[Security] Global error handler enabled (${config.env === 'production' ? 'production mode - sanitized responses' : 'development mode - detailed errors'})`
  );

  // Register static file serving for frontend demo
  await app.server.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/',
  });

  // Register tRPC routes at /trpc
  await registerTRPCPlugin(app.server, {
    prefix: '/trpc',
    router: appRouter,
  });

  console.log('[tRPC] Registered at /trpc');

  // Register REST API routes at /api
  const collections = [authProcedures, userProcedures, healthProcedures];
  registerRestRoutes(app.server, collections, { prefix: config.apiPrefix });

  return { app, collections };
}

/**
 * Prints startup banner with route information
 */
function printBanner(collections: Parameters<typeof getRouteSummary>[0]) {
  const divider = '═'.repeat(50);

  console.log(`\n${divider}`);
  console.log(`  VeloxTS Playground v${VELOX_VERSION}`);
  console.log(`  Environment: ${config.env}`);
  console.log(divider);

  // Print registered routes
  const routes = getRouteSummary(collections);
  console.log('\n📍 Registered Routes:\n');

  for (const route of routes) {
    const method = route.method.padEnd(6);
    const path = route.path.padEnd(25);
    console.log(`   ${method} ${path} → ${route.namespace}.${route.procedure}`);
  }

  console.log(`\n${divider}`);
  console.log(`  Frontend: http://localhost:${config.port}`);
  console.log(`  REST API: http://localhost:${config.port}${config.apiPrefix}`);
  console.log(`  tRPC:     http://localhost:${config.port}/trpc`);
  console.log(`${divider}\n`);

  // Print example curl commands
  console.log('📝 Example requests:\n');
  console.log('   # Health check');
  console.log(`   curl http://localhost:${config.port}${config.apiPrefix}/health`);
  console.log('');
  console.log('   # Public user endpoints');
  console.log(`   curl http://localhost:${config.port}${config.apiPrefix}/users`);
  console.log(
    `   curl http://localhost:${config.port}${config.apiPrefix}/users/550e8400-e29b-41d4-a716-446655440001`
  );
  console.log('');
  console.log('   # Authentication');
  console.log(
    `   curl -X POST http://localhost:${config.port}${config.apiPrefix}/auth/register \\`
  );
  console.log('        -H "Content-Type: application/json" \\');
  console.log(
    '        -d \'{"name":"John Doe","email":"john@example.com","password":"secret123"}\''
  );
  console.log('');
  console.log(`   curl -X POST http://localhost:${config.port}${config.apiPrefix}/auth/login \\`);
  console.log('        -H "Content-Type: application/json" \\');
  console.log('        -d \'{"email":"john@example.com","password":"secret123"}\'');
  console.log('');
  console.log('   # Protected endpoint (use token from login response)');
  console.log(`   curl http://localhost:${config.port}${config.apiPrefix}/auth/me \\`);
  console.log('        -H "Authorization: Bearer <your-access-token>"');
  console.log('');
}

/**
 * Main entry point
 */
async function main() {
  try {
    const { app, collections } = await createApp();

    await app.start();

    // Send ready signal to CLI for accurate HMR timing
    if (process.send) {
      process.send({ type: 'velox:ready' });
    }

    printBanner(collections);

    // Graceful shutdown - disconnect Prisma to prevent connection pool leaks
    const shutdown = async () => {
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start playground:', error);
    process.exit(1);
  }
}

// ============================================================================
// Exports
// ============================================================================

// Re-export for external usage and testing
export { createApp, main };

// Export types for client type inference
// The AppRouter type from tRPC is what clients need for full type safety
export type { AppRouter } from './trpc/index.js';

// Run if executed directly
main();
