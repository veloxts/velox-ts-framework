/**
 * Swagger UI Fastify Plugin
 *
 * Serves Swagger UI documentation for VeloxTS APIs.
 *
 * @module @veloxts/router/openapi/plugin
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { generateOpenApiSpec } from './generator.js';
import type { OpenAPISpec, SwaggerUIConfig, SwaggerUIPluginOptions } from './types.js';

// ============================================================================
// Swagger UI HTML Generation
// ============================================================================

/**
 * Default Swagger UI configuration
 */
const DEFAULT_UI_CONFIG: SwaggerUIConfig = {
  deepLinking: true,
  displayOperationId: false,
  defaultModelsExpandDepth: 1,
  defaultModelExpandDepth: 1,
  docExpansion: 'list',
  filter: false,
  showExtensions: false,
  tryItOutEnabled: true,
  persistAuthorization: false,
};

/**
 * Swagger UI CDN URLs
 */
const SWAGGER_UI_CDN = {
  css: 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css',
  bundle: 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js',
  standalonePreset: 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js',
};

/**
 * Generates the Swagger UI HTML page
 */
function generateSwaggerUIHtml(
  specUrl: string,
  config: SwaggerUIConfig,
  title: string,
  favicon?: string
): string {
  const configJson = JSON.stringify({
    url: specUrl,
    dom_id: '#swagger-ui',
    deepLinking: config.deepLinking,
    displayOperationId: config.displayOperationId,
    defaultModelsExpandDepth: config.defaultModelsExpandDepth,
    defaultModelExpandDepth: config.defaultModelExpandDepth,
    docExpansion: config.docExpansion,
    filter: config.filter,
    showExtensions: config.showExtensions,
    tryItOutEnabled: config.tryItOutEnabled,
    persistAuthorization: config.persistAuthorization,
    presets: ['SwaggerUIBundle.presets.apis', 'SwaggerUIStandalonePreset'],
    plugins: ['SwaggerUIBundle.plugins.DownloadUrl'],
    layout: 'StandaloneLayout',
  });

  const faviconTag = favicon ? `<link rel="icon" type="image/x-icon" href="${favicon}">` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${faviconTag}
  <link rel="stylesheet" href="${SWAGGER_UI_CDN.css}">
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_UI_CDN.bundle}"></script>
  <script src="${SWAGGER_UI_CDN.standalonePreset}"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle(${configJson.replace(
        /"(SwaggerUIBundle\.presets\.apis|SwaggerUIStandalonePreset|SwaggerUIBundle\.plugins\.DownloadUrl)"/g,
        '$1'
      )});
    };
  </script>
</body>
</html>`;
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

  // Merge UI config with defaults
  const mergedConfig: SwaggerUIConfig = {
    ...DEFAULT_UI_CONFIG,
    ...uiConfig,
  };

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
  const htmlContent = generateSwaggerUIHtml(specRoute, mergedConfig, title, favicon);

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
