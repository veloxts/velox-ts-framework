/**
 * Swagger UI Fastify Plugin
 *
 * Serves Swagger UI documentation for VeloxTS APIs.
 *
 * @module @veloxts/router/openapi/plugin
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { generateOpenApiSpec } from './generator.js';
import { generateSwaggerUIHtml } from './html-generator.js';
import type { OpenAPISpec, SwaggerUIPluginOptions } from './types.js';

// ============================================================================
// Fastify Plugin
// ============================================================================

/**
 * Swagger UI Fastify plugin
 *
 * Registers routes for serving Swagger UI and the OpenAPI specification.
 *
 * @example
 * ```typescript
 * import { swaggerUIPlugin } from '@veloxts/router';
 *
 * app.register(swaggerUIPlugin, {
 *   routePrefix: '/docs',
 *   collections: [userProcedures, postProcedures],
 *   openapi: {
 *     info: {
 *       title: 'My API',
 *       version: '1.0.0',
 *       description: 'A VeloxTS-powered API',
 *     },
 *     servers: [{ url: 'http://localhost:3030' }],
 *   },
 * });
 * ```
 */
export const swaggerUIPlugin: FastifyPluginAsync<SwaggerUIPluginOptions> = async (
  fastify,
  options
) => {
  const {
    routePrefix = '/docs',
    specRoute = `${routePrefix}/openapi.json`,
    uiConfig = {},
    openapi,
    collections,
    title = 'API Documentation',
    favicon,
  } = options;

  // Generate the OpenAPI specification
  let spec: OpenAPISpec;
  try {
    spec = generateOpenApiSpec(collections, openapi);
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
 * Creates a Swagger UI plugin with pre-configured options
 *
 * @param options - Plugin options
 * @returns Configured plugin
 *
 * @example
 * ```typescript
 * import { createSwaggerUI } from '@veloxts/router';
 *
 * const docs = createSwaggerUI({
 *   collections: [userProcedures],
 *   openapi: {
 *     info: { title: 'My API', version: '1.0.0' },
 *   },
 * });
 *
 * app.register(docs);
 * ```
 */
export function createSwaggerUI(
  options: SwaggerUIPluginOptions
): FastifyPluginAsync<SwaggerUIPluginOptions> {
  return async (fastify) => {
    await swaggerUIPlugin(fastify, options);
  };
}

/**
 * Registers multiple procedure collections with Swagger UI
 *
 * Convenience function that sets up both REST routes and documentation.
 *
 * @param fastify - Fastify instance
 * @param options - Documentation options
 *
 * @example
 * ```typescript
 * import { registerDocs } from '@veloxts/router';
 *
 * await registerDocs(app, {
 *   collections: [userProcedures, postProcedures],
 *   openapi: {
 *     info: { title: 'My API', version: '1.0.0' },
 *   },
 * });
 * ```
 */
export async function registerDocs(
  fastify: {
    register: (
      plugin: FastifyPluginAsync<SwaggerUIPluginOptions>,
      options: SwaggerUIPluginOptions
    ) => Promise<void>;
  },
  options: SwaggerUIPluginOptions
): Promise<void> {
  await fastify.register(swaggerUIPlugin, options);
}

/**
 * Gets the generated OpenAPI specification without registering routes
 *
 * Useful for testing or exporting the spec programmatically.
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
  return generateOpenApiSpec(options.collections, options.openapi);
}
