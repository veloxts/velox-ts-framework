/**
 * Swagger UI Fastify Plugin
 *
 * Serves Swagger UI documentation for VeloxTS APIs.
 *
 * @module @veloxts/router/openapi/plugin
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { getRegisteredCollections } from '../rest/registry.js';
import { generateOpenApiSpec, generateOpenApiSpecFromRegistry } from './generator.js';
import { generateSwaggerUIHtml } from './html-generator.js';
import type { OpenAPISpec, SwaggerUIPluginOptions } from './types.js';

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Build an OpenAPI spec from plugin options.
 *
 * - Explicit `collections` → use `generateOpenApiSpec` (single global prefix)
 * - No collections → auto-discover from the registry (per-entry prefix)
 */
function buildSpec(options: SwaggerUIPluginOptions): OpenAPISpec {
  const { collections, openapi } = options;

  if (collections && collections.length > 0) {
    return generateOpenApiSpec(collections, openapi);
  }

  const registered = getRegisteredCollections();
  return generateOpenApiSpecFromRegistry(registered, openapi);
}

// ============================================================================
// Fastify Plugin
// ============================================================================

/**
 * Swagger UI Fastify plugin
 *
 * Registers routes for serving Swagger UI and the OpenAPI specification.
 *
 * When `collections` is omitted, the plugin auto-discovers all collections
 * previously registered via `rest()`, using each collection's effective prefix.
 *
 * @example
 * ```typescript
 * import { swaggerPlugin } from '@veloxts/router';
 *
 * // Explicit collections (backward compatible)
 * app.register(swaggerPlugin, {
 *   routePrefix: '/docs',
 *   collections: [userProcedures, postProcedures],
 *   openapi: {
 *     info: { title: 'My API', version: '1.0.0' },
 *     servers: [{ url: 'http://localhost:3030' }],
 *   },
 * });
 *
 * // Auto-discovery — no collections needed
 * app.register(swaggerPlugin, {
 *   openapi: { info: { title: 'My API', version: '1.0.0' } },
 * });
 * ```
 */
export const swaggerPlugin: FastifyPluginAsync<SwaggerUIPluginOptions> = async (
  fastify,
  options
) => {
  const {
    routePrefix = '/docs',
    specRoute = `${routePrefix}/openapi.json`,
    uiConfig = {},
    title = 'API Documentation',
    favicon,
  } = options;

  // Generate the OpenAPI specification
  let spec: OpenAPISpec;
  try {
    spec = buildSpec(options);
  } catch (error) {
    fastify.log.error(error, '[VeloxTS] Failed to generate OpenAPI specification');
    throw error;
  }

  // Register OpenAPI JSON route
  fastify.get(specRoute, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.header('Content-Type', 'application/json').send(spec);
  });

  // Register Swagger UI HTML route
  const htmlContent = generateSwaggerUIHtml({
    specUrl: specRoute,
    title,
    favicon,
    config: uiConfig,
  });

  fastify.get(routePrefix, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.header('Content-Type', 'text/html; charset=utf-8').send(htmlContent);
  });

  // Also serve at /docs/ (with trailing slash)
  if (!routePrefix.endsWith('/')) {
    fastify.get(`${routePrefix}/`, async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.header('Content-Type', 'text/html; charset=utf-8').send(htmlContent);
    });
  }

  fastify.log.info(`[VeloxTS] Swagger UI available at ${routePrefix}, spec at ${specRoute}`);
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Gets the generated OpenAPI specification without registering routes
 *
 * Useful for testing or exporting the spec programmatically.
 * Supports auto-discovery when `collections` is omitted.
 *
 * @param options - Plugin options
 * @returns Generated OpenAPI specification
 *
 * @example
 * ```typescript
 * import { getOpenApiSpec } from '@veloxts/router';
 * import fs from 'fs';
 *
 * const spec = getOpenApiSpec({
 *   collections: [userProcedures],
 *   openapi: {
 *     info: { title: 'My API', version: '1.0.0' },
 *   },
 * });
 *
 * fs.writeFileSync('openapi.json', JSON.stringify(spec, null, 2));
 * ```
 */
export function getOpenApiSpec(options: SwaggerUIPluginOptions): OpenAPISpec {
  return buildSpec(options);
}
