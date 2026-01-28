/**
 * OpenAPI Module
 *
 * Generates OpenAPI 3.0.3 specifications from VeloxTS procedure collections.
 *
 * @module @veloxts/router/openapi
 *
 * @example
 * ```typescript
 * import {
 *   generateOpenApiSpec,
 *   swaggerUIPlugin,
 *   createSwaggerUI,
 * } from '@veloxts/router';
 *
 * // Generate spec programmatically
 * const spec = generateOpenApiSpec([userProcedures, postProcedures], {
 *   info: { title: 'My API', version: '1.0.0' },
 *   prefix: '/api',
 * });
 *
 * // Or register Swagger UI plugin
 * app.register(swaggerUIPlugin, {
 *   routePrefix: '/docs',
 *   collections: [userProcedures],
 *   openapi: {
 *     info: { title: 'My API', version: '1.0.0' },
 *   },
 * });
 * ```
 */

// ============================================================================
// Generator
// ============================================================================

export {
  generateOpenApiSpec,
  getOpenApiRouteSummary,
  validateOpenApiSpec,
} from './generator.js';

// ============================================================================
// Plugin
// ============================================================================

export {
  createSwaggerUI,
  getOpenApiSpec,
  registerDocs,
  swaggerUIPlugin,
} from './plugin.js';

// ============================================================================
// HTML Generator
// ============================================================================

export {
  DEFAULT_UI_CONFIG,
  escapeHtml,
  generateSwaggerUIHtml,
  SWAGGER_UI_CDN,
  type SwaggerUIHtmlOptions,
} from './html-generator.js';

// ============================================================================
// Schema Converter
// ============================================================================

export {
  createStringSchema,
  extractSchemaProperties,
  mergeSchemas,
  removeSchemaProperties,
  type SchemaConversionOptions,
  schemaHasProperties,
  zodSchemaToJsonSchema,
} from './schema-converter.js';

// ============================================================================
// Path Extractor
// ============================================================================

export {
  type BuildParametersOptions,
  type BuildParametersResult,
  buildParameters,
  convertFromOpenAPIPath,
  convertToOpenAPIPath,
  extractPathParamNames,
  extractQueryParameters,
  extractResourceFromPath,
  hasPathParameters,
  joinPaths,
  normalizePath,
  parsePathParameters,
  type QueryParamExtractionOptions,
} from './path-extractor.js';

// ============================================================================
// Security Mapper
// ============================================================================

export {
  createSecurityRequirement,
  DEFAULT_GUARD_MAPPINGS,
  DEFAULT_SECURITY_SCHEMES,
  extractGuardScopes,
  extractUsedSecuritySchemes,
  filterUsedSecuritySchemes,
  type GuardMappingOptions,
  guardsRequireAuth,
  guardsToSecurity,
  mapGuardToSecurity,
  mergeSecuritySchemes,
} from './security-mapper.js';

// ============================================================================
// Types
// ============================================================================

export type {
  JSONSchema,
  OpenAPIComponents,
  OpenAPIContact,
  OpenAPIEncoding,
  OpenAPIExample,
  OpenAPIExternalDocs,
  OpenAPIGeneratorOptions,
  OpenAPIHeader,
  OpenAPIHttpMethod,
  OpenAPIInfo,
  OpenAPILicense,
  OpenAPILink,
  OpenAPIMediaType,
  OpenAPIOAuthFlow,
  OpenAPIOAuthFlows,
  OpenAPIOperation,
  OpenAPIParameter,
  OpenAPIPathItem,
  OpenAPIRequestBody,
  OpenAPIResponse,
  OpenAPISecurityRequirement,
  OpenAPISecurityScheme,
  OpenAPIServer,
  OpenAPISpec,
  OpenAPITag,
  ParameterIn,
  RouteInfo,
  SecuritySchemeType,
  SwaggerUIConfig,
  SwaggerUIPluginOptions,
} from './types.js';
