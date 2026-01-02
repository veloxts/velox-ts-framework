/**
 * OpenAPI 3.0.3 Type Definitions
 *
 * Type-safe definitions for generating OpenAPI specifications from VeloxTS procedures.
 *
 * @module @veloxts/router/openapi/types
 */

import type { ProcedureCollection } from '../types.js';

// ============================================================================
// JSON Schema Types
// ============================================================================

/**
 * JSON Schema representation for OpenAPI
 */
export type JSONSchema = {
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  nullable?: boolean;

  // Object properties
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  patternProperties?: Record<string, JSONSchema>;
  minProperties?: number;
  maxProperties?: number;

  // Array properties
  items?: JSONSchema | JSONSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // String properties
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Number properties
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  // Composition
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;

  // References
  $ref?: string;

  // OpenAPI extensions
  example?: unknown;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;

  // Allow additional properties for extensions
  [key: string]: unknown;
};

// ============================================================================
// OpenAPI Info Types
// ============================================================================

/**
 * Contact information for the API
 */
export interface OpenAPIContact {
  name?: string;
  url?: string;
  email?: string;
}

/**
 * License information for the API
 */
export interface OpenAPILicense {
  name: string;
  url?: string;
}

/**
 * API metadata
 */
export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: OpenAPIContact;
  license?: OpenAPILicense;
}

/**
 * Server information
 */
export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<
    string,
    {
      default: string;
      enum?: string[];
      description?: string;
    }
  >;
}

// ============================================================================
// OpenAPI Parameter Types
// ============================================================================

/**
 * Parameter location
 */
export type ParameterIn = 'path' | 'query' | 'header' | 'cookie';

/**
 * Parameter definition
 */
export interface OpenAPIParameter {
  name: string;
  in: ParameterIn;
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  schema: JSONSchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExample>;
}

/**
 * Example object
 */
export interface OpenAPIExample {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

// ============================================================================
// OpenAPI Request/Response Types
// ============================================================================

/**
 * Media type object
 */
export interface OpenAPIMediaType {
  schema?: JSONSchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExample>;
  encoding?: Record<string, OpenAPIEncoding>;
}

/**
 * Encoding object for multipart requests
 */
export interface OpenAPIEncoding {
  contentType?: string;
  headers?: Record<string, OpenAPIHeader>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

/**
 * Header object
 */
export interface OpenAPIHeader {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: JSONSchema;
  example?: unknown;
}

/**
 * Request body definition
 */
export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, OpenAPIMediaType>;
}

/**
 * Response definition
 */
export interface OpenAPIResponse {
  description: string;
  headers?: Record<string, OpenAPIHeader>;
  content?: Record<string, OpenAPIMediaType>;
  links?: Record<string, OpenAPILink>;
}

/**
 * Link object for response linking
 */
export interface OpenAPILink {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, unknown>;
  requestBody?: unknown;
  description?: string;
  server?: OpenAPIServer;
}

// ============================================================================
// OpenAPI Security Types
// ============================================================================

/**
 * Security scheme types
 */
export type SecuritySchemeType = 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';

/**
 * OAuth2 flow object
 */
export interface OpenAPIOAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

/**
 * OAuth2 flows object
 */
export interface OpenAPIOAuthFlows {
  implicit?: OpenAPIOAuthFlow;
  password?: OpenAPIOAuthFlow;
  clientCredentials?: OpenAPIOAuthFlow;
  authorizationCode?: OpenAPIOAuthFlow;
}

/**
 * Security scheme definition
 */
export interface OpenAPISecurityScheme {
  type: SecuritySchemeType;
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OpenAPIOAuthFlows;
  openIdConnectUrl?: string;
}

/**
 * Security requirement object
 */
export type OpenAPISecurityRequirement = Record<string, string[]>;

// ============================================================================
// OpenAPI Operation Types
// ============================================================================

/**
 * External documentation object
 */
export interface OpenAPIExternalDocs {
  url: string;
  description?: string;
}

/**
 * Operation object (endpoint definition)
 */
export interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  externalDocs?: OpenAPIExternalDocs;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  callbacks?: Record<string, Record<string, OpenAPIPathItem>>;
  deprecated?: boolean;
  security?: OpenAPISecurityRequirement[];
  servers?: OpenAPIServer[];
}

/**
 * Path item object (all operations for a path)
 */
export interface OpenAPIPathItem {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: OpenAPIOperation;
  put?: OpenAPIOperation;
  post?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  trace?: OpenAPIOperation;
  servers?: OpenAPIServer[];
  parameters?: OpenAPIParameter[];
}

// ============================================================================
// OpenAPI Components Types
// ============================================================================

/**
 * Components object for reusable definitions
 */
export interface OpenAPIComponents {
  schemas?: Record<string, JSONSchema>;
  responses?: Record<string, OpenAPIResponse>;
  parameters?: Record<string, OpenAPIParameter>;
  examples?: Record<string, OpenAPIExample>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  headers?: Record<string, OpenAPIHeader>;
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
  links?: Record<string, OpenAPILink>;
  callbacks?: Record<string, Record<string, OpenAPIPathItem>>;
}

/**
 * Tag object for grouping operations
 */
export interface OpenAPITag {
  name: string;
  description?: string;
  externalDocs?: OpenAPIExternalDocs;
}

// ============================================================================
// OpenAPI Specification (Root)
// ============================================================================

/**
 * Complete OpenAPI 3.0.3 specification
 */
export interface OpenAPISpec {
  openapi: '3.0.3';
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  components?: OpenAPIComponents;
  security?: OpenAPISecurityRequirement[];
  tags?: OpenAPITag[];
  externalDocs?: OpenAPIExternalDocs;
}

// ============================================================================
// Generator Options
// ============================================================================

/**
 * Options for OpenAPI specification generation
 */
export interface OpenAPIGeneratorOptions {
  /**
   * API info metadata (required)
   */
  info: OpenAPIInfo;

  /**
   * Server URLs for the API
   */
  servers?: OpenAPIServer[];

  /**
   * API prefix prepended to all paths
   * @default '/api'
   */
  prefix?: string;

  /**
   * Security scheme definitions
   * Merged with default schemes (bearerAuth)
   */
  securitySchemes?: Record<string, OpenAPISecurityScheme>;

  /**
   * Default security for all endpoints
   * Applied when no guards are present
   */
  defaultSecurity?: OpenAPISecurityRequirement[];

  /**
   * Custom guard name to security scheme mapping
   * @example { 'authenticated': 'bearerAuth', 'apiKey': 'apiKeyAuth' }
   */
  guardToSecurityMap?: Record<string, string>;

  /**
   * Tag descriptions for namespaces
   * @example { 'users': 'User management endpoints' }
   */
  tagDescriptions?: Record<string, string>;

  /**
   * External documentation link
   */
  externalDocs?: OpenAPIExternalDocs;

  /**
   * Additional OpenAPI extensions (x-* properties)
   */
  extensions?: Record<string, unknown>;
}

// ============================================================================
// Swagger UI Plugin Options
// ============================================================================

/**
 * Swagger UI configuration options
 */
export interface SwaggerUIConfig {
  /**
   * Enable deep linking for tags and operations
   * @default true
   */
  deepLinking?: boolean;

  /**
   * Display operationId in the UI
   * @default false
   */
  displayOperationId?: boolean;

  /**
   * Default expand depth for models section
   * @default 1
   */
  defaultModelsExpandDepth?: number;

  /**
   * Default expand depth for model properties
   * @default 1
   */
  defaultModelExpandDepth?: number;

  /**
   * Controls expansion of operations and tags
   * @default 'list'
   */
  docExpansion?: 'list' | 'full' | 'none';

  /**
   * Enable filter/search box
   * @default false
   */
  filter?: boolean | string;

  /**
   * Show extensions (x-* fields)
   * @default false
   */
  showExtensions?: boolean;

  /**
   * Enable "Try it out" by default
   * @default true
   */
  tryItOutEnabled?: boolean;

  /**
   * Persist authorization data across browser sessions
   * @default false
   */
  persistAuthorization?: boolean;
}

/**
 * Options for the Swagger UI Fastify plugin
 */
export interface SwaggerUIPluginOptions {
  /**
   * Route prefix for Swagger UI
   * @default '/docs'
   */
  routePrefix?: string;

  /**
   * Route for raw OpenAPI JSON
   * @default '/docs/openapi.json'
   */
  specRoute?: string;

  /**
   * Swagger UI configuration
   */
  uiConfig?: SwaggerUIConfig;

  /**
   * OpenAPI generator options
   */
  openapi: OpenAPIGeneratorOptions;

  /**
   * Procedure collections to document
   */
  collections: ProcedureCollection[];

  /**
   * Custom page title
   * @default 'API Documentation'
   */
  title?: string;

  /**
   * Custom favicon URL
   */
  favicon?: string;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * HTTP methods supported by OpenAPI
 */
export type OpenAPIHttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';

/**
 * Route information for generation
 */
export interface RouteInfo {
  method: OpenAPIHttpMethod;
  path: string;
  operationId: string;
  namespace: string;
  procedureName: string;
  inputSchema?: JSONSchema;
  outputSchema?: JSONSchema;
  guards: string[];
  deprecated?: boolean;
}
