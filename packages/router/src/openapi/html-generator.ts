/**
 * Swagger UI HTML Generator
 *
 * Generates standalone Swagger UI HTML pages for displaying OpenAPI specifications.
 * This module is used by both the Fastify plugin and CLI serve command.
 *
 * @module @veloxts/router/openapi/html-generator
 */

import type { SwaggerUIConfig } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default Swagger UI configuration
 */
export const DEFAULT_UI_CONFIG: SwaggerUIConfig = {
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
export const SWAGGER_UI_CDN = {
  css: 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css',
  bundle: 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js',
  standalonePreset: 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js',
};

// ============================================================================
// HTML Generation Options
// ============================================================================

/**
 * Options for generating Swagger UI HTML
 */
export interface SwaggerUIHtmlOptions {
  /**
   * URL where the OpenAPI spec can be fetched
   */
  specUrl: string;

  /**
   * Page title
   * @default 'API Documentation'
   */
  title?: string;

  /**
   * Custom favicon URL
   */
  favicon?: string;

  /**
   * Swagger UI configuration options
   */
  config?: Partial<SwaggerUIConfig>;
}

// ============================================================================
// HTML Generation
// ============================================================================

/**
 * Generates a standalone Swagger UI HTML page
 *
 * @param options - HTML generation options
 * @returns Complete HTML document as string
 *
 * @example
 * ```typescript
 * const html = generateSwaggerUIHtml({
 *   specUrl: '/openapi.json',
 *   title: 'My API Documentation',
 *   config: { tryItOutEnabled: true },
 * });
 * ```
 */
export function generateSwaggerUIHtml(options: SwaggerUIHtmlOptions): string {
  const { specUrl, title = 'API Documentation', favicon, config = {} } = options;

  // Merge config with defaults
  const mergedConfig: SwaggerUIConfig = {
    ...DEFAULT_UI_CONFIG,
    ...config,
  };

  const configJson = JSON.stringify({
    url: specUrl,
    dom_id: '#swagger-ui',
    deepLinking: mergedConfig.deepLinking,
    displayOperationId: mergedConfig.displayOperationId,
    defaultModelsExpandDepth: mergedConfig.defaultModelsExpandDepth,
    defaultModelExpandDepth: mergedConfig.defaultModelExpandDepth,
    docExpansion: mergedConfig.docExpansion,
    filter: mergedConfig.filter,
    showExtensions: mergedConfig.showExtensions,
    tryItOutEnabled: mergedConfig.tryItOutEnabled,
    persistAuthorization: mergedConfig.persistAuthorization,
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
 * Escapes HTML special characters to prevent XSS
 *
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
