/**
 * OpenAPI Generator
 *
 * Generates OpenAPI 3.0.3 specifications from VeloxTS procedure collections.
 *
 * @module @veloxts/router/openapi/generator
 */

import type { ZodType } from 'zod';

import { generateRestRoutes, type RestRoute } from '../rest/adapter.js';
import type { GuardLike, HttpMethod, ProcedureCollection } from '../types.js';
import { buildParameters, convertToOpenAPIPath, joinPaths } from './path-extractor.js';
import { removeSchemaProperties, zodSchemaToJsonSchema } from './schema-converter.js';
import {
  extractUsedSecuritySchemes,
  filterUsedSecuritySchemes,
  guardsToSecurity,
  mergeSecuritySchemes,
} from './security-mapper.js';
import type {
  JSONSchema,
  OpenAPIGeneratorOptions,
  OpenAPIHttpMethod,
  OpenAPIOperation,
  OpenAPIPathItem,
  OpenAPIRequestBody,
  OpenAPIResponse,
  OpenAPISpec,
  OpenAPITag,
} from './types.js';

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generates an OpenAPI 3.0.3 specification from procedure collections
 *
 * @param collections - Array of procedure collections to document
 * @param options - Generator options
 * @returns Complete OpenAPI specification
 *
 * @example
 * ```typescript
 * import { generateOpenApiSpec } from '@veloxts/router';
 *
 * const spec = generateOpenApiSpec([userProcedures, postProcedures], {
 *   info: {
 *     title: 'My API',
 *     version: '1.0.0',
 *     description: 'A VeloxTS-powered API',
 *   },
 *   prefix: '/api',
 *   servers: [{ url: 'http://localhost:3030' }],
 * });
 * ```
 */
export function generateOpenApiSpec(
  collections: ProcedureCollection[],
  options: OpenAPIGeneratorOptions
): OpenAPISpec {
  const prefix = options.prefix ?? '/api';
  const paths: Record<string, OpenAPIPathItem> = {};
  const tags: OpenAPITag[] = [];
  const allGuards: Array<GuardLike<unknown>> = [];

  // Process each collection
  for (const collection of collections) {
    const routes = generateRestRoutes(collection);

    // Add tag for this namespace
    tags.push({
      name: collection.namespace,
      description: options.tagDescriptions?.[collection.namespace],
    });

    // Process each route
    for (const route of routes) {
      // Build full path with prefix
      const fullPath = joinPaths(prefix, route.path);
      const openApiPath = convertToOpenAPIPath(fullPath);

      // Initialize path item if not exists
      if (!paths[openApiPath]) {
        paths[openApiPath] = {};
      }

      // Collect guards for security scheme filtering
      // Cast to unknown to avoid variance issues - we only use guard names
      allGuards.push(...(route.procedure.guards as readonly GuardLike<unknown>[]));

      // Generate operation
      const operation = generateOperation(route, collection.namespace, options);

      // Add to path item
      const method = route.method.toLowerCase() as OpenAPIHttpMethod;
      paths[openApiPath][method] = operation;
    }
  }

  // Build security schemes (only include those that are used)
  const allSchemes = mergeSecuritySchemes(options.securitySchemes);
  const usedSchemes = extractUsedSecuritySchemes(allGuards, {
    customMappings: options.guardToSecurityMap,
  });
  const securitySchemes = filterUsedSecuritySchemes(allSchemes, usedSchemes);

  // Build the spec
  const spec: OpenAPISpec = {
    openapi: '3.0.3',
    info: options.info,
    paths,
    tags,
  };

  // Add optional fields
  if (options.servers?.length) {
    spec.servers = options.servers;
  }

  if (Object.keys(securitySchemes).length > 0) {
    spec.components = { securitySchemes };
  }

  if (options.defaultSecurity?.length) {
    spec.security = options.defaultSecurity;
  }

  if (options.externalDocs) {
    spec.externalDocs = options.externalDocs;
  }

  // Add extensions
  if (options.extensions) {
    Object.assign(spec, options.extensions);
  }

  return spec;
}

// ============================================================================
// Operation Generation
// ============================================================================

/**
 * Generates an OpenAPI operation from a REST route
 */
function generateOperation(
  route: RestRoute,
  namespace: string,
  options: OpenAPIGeneratorOptions
): OpenAPIOperation {
  const { procedure, procedureName, method, path } = route;

  // Convert Zod schemas to JSON Schema
  const inputSchema = procedure.inputSchema
    ? zodSchemaToJsonSchema(procedure.inputSchema as ZodType)
    : undefined;
  const outputSchema = procedure.outputSchema
    ? zodSchemaToJsonSchema(procedure.outputSchema as ZodType)
    : undefined;

  // Build parameters
  const { pathParams, queryParams, pathParamNames } = buildParameters({
    path,
    method,
    inputSchema,
  });

  // Combine all parameters
  const parameters = [...pathParams, ...queryParams];

  // Build request body for POST, PUT, PATCH
  const requestBody = buildRequestBody(method, inputSchema, pathParamNames);

  // Map guards to security requirements
  // Cast to unknown to avoid variance issues - we only use guard names
  const security = guardsToSecurity(procedure.guards as readonly GuardLike<unknown>[], {
    customMappings: options.guardToSecurityMap,
  });

  // Build responses
  const responses = buildResponses(method, outputSchema, security.length > 0);

  // Build operation
  const operation: OpenAPIOperation = {
    operationId: `${namespace}_${procedureName}`,
    summary: inferSummary(procedureName),
    tags: [namespace],
    responses,
  };

  // Add optional fields
  if (parameters.length > 0) {
    operation.parameters = parameters;
  }

  if (requestBody) {
    operation.requestBody = requestBody;
  }

  if (security.length > 0) {
    operation.security = security;
  }

  return operation;
}

// ============================================================================
// Request Body Generation
// ============================================================================

/**
 * Builds a request body definition for mutation methods
 */
function buildRequestBody(
  method: HttpMethod,
  inputSchema: JSONSchema | undefined,
  pathParamNames: string[]
): OpenAPIRequestBody | undefined {
  // Only POST, PUT, PATCH have request bodies
  if (!['POST', 'PUT', 'PATCH'].includes(method)) {
    return undefined;
  }

  if (!inputSchema) {
    return undefined;
  }

  // Remove path parameters from body schema
  const bodySchema = removeSchemaProperties(inputSchema, pathParamNames);

  // If no properties left, no body needed
  if (!bodySchema || !hasProperties(bodySchema)) {
    return undefined;
  }

  return {
    required: true,
    content: {
      'application/json': {
        schema: bodySchema,
      },
    },
  };
}

/**
 * Checks if a schema has any properties
 */
function hasProperties(schema: JSONSchema): boolean {
  if (schema.type !== 'object') return true; // Non-object schemas are valid
  if (!schema.properties) return false;
  return Object.keys(schema.properties).length > 0;
}

// ============================================================================
// Response Generation
// ============================================================================

/**
 * Builds response definitions for an operation
 */
function buildResponses(
  method: HttpMethod,
  outputSchema: JSONSchema | undefined,
  hasAuth: boolean
): Record<string, OpenAPIResponse> {
  const responses: Record<string, OpenAPIResponse> = {};

  // Determine success status code
  const successCode = getSuccessStatusCode(method);
  const successDescription = getSuccessDescription(method);

  // Success response
  if (successCode === '204') {
    // No content
    responses['204'] = { description: successDescription };
  } else {
    responses[successCode] = {
      description: successDescription,
      ...(outputSchema && {
        content: {
          'application/json': { schema: outputSchema },
        },
      }),
    };
  }

  // Error responses
  responses['400'] = {
    description: 'Bad Request - Validation error',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string' },
                details: { type: 'object' },
              },
              required: ['code', 'message'],
            },
          },
          required: ['error'],
        },
      },
    },
  };

  // Auth-related responses
  if (hasAuth) {
    responses['401'] = {
      description: 'Unauthorized - Authentication required',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'UNAUTHORIZED' },
                  message: { type: 'string' },
                },
                required: ['code', 'message'],
              },
            },
            required: ['error'],
          },
        },
      },
    };

    responses['403'] = {
      description: 'Forbidden - Insufficient permissions',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'FORBIDDEN' },
                  message: { type: 'string' },
                },
                required: ['code', 'message'],
              },
            },
            required: ['error'],
          },
        },
      },
    };
  }

  // Not found for single-resource operations
  if (['GET', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    responses['404'] = {
      description: 'Not Found - Resource does not exist',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'NOT_FOUND' },
                  message: { type: 'string' },
                },
                required: ['code', 'message'],
              },
            },
            required: ['error'],
          },
        },
      },
    };
  }

  // Internal server error
  responses['500'] = {
    description: 'Internal Server Error',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'INTERNAL_ERROR' },
                message: { type: 'string' },
              },
              required: ['code', 'message'],
            },
          },
          required: ['error'],
        },
      },
    },
  };

  return responses;
}

/**
 * Gets the success status code for an HTTP method
 */
function getSuccessStatusCode(method: HttpMethod): string {
  switch (method) {
    case 'POST':
      return '201';
    case 'DELETE':
      return '204';
    default:
      return '200';
  }
}

/**
 * Gets the success description for an HTTP method
 */
function getSuccessDescription(method: HttpMethod): string {
  switch (method) {
    case 'POST':
      return 'Created';
    case 'DELETE':
      return 'No Content';
    case 'PUT':
    case 'PATCH':
      return 'Updated';
    default:
      return 'Success';
  }
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Infers a human-readable summary from a procedure name
 *
 * Converts camelCase to Title Case with spaces.
 *
 * @example
 * ```typescript
 * inferSummary('getUser')     // 'Get User'
 * inferSummary('createPost')  // 'Create Post'
 * inferSummary('listUsers')   // 'List Users'
 * ```
 */
function inferSummary(procedureName: string): string {
  // Insert space before capital letters
  const spaced = procedureName.replace(/([A-Z])/g, ' $1').trim();

  // Capitalize first letter
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Gets route summary information for debugging/logging
 *
 * @param collections - Procedure collections
 * @param prefix - API prefix
 * @returns Array of route summaries
 */
export function getOpenApiRouteSummary(
  collections: ProcedureCollection[],
  prefix = '/api'
): Array<{ method: string; path: string; operationId: string; namespace: string }> {
  const routes: Array<{ method: string; path: string; operationId: string; namespace: string }> =
    [];

  for (const collection of collections) {
    const collectionRoutes = generateRestRoutes(collection);

    for (const route of collectionRoutes) {
      const fullPath = joinPaths(prefix, route.path);
      routes.push({
        method: route.method,
        path: convertToOpenAPIPath(fullPath),
        operationId: `${collection.namespace}_${route.procedureName}`,
        namespace: collection.namespace,
      });
    }
  }

  return routes;
}

/**
 * Validates an OpenAPI spec for common issues
 *
 * @param spec - OpenAPI spec to validate
 * @returns Array of validation warnings
 */
export function validateOpenApiSpec(spec: OpenAPISpec): string[] {
  const warnings: string[] = [];

  // Check for empty paths
  if (Object.keys(spec.paths).length === 0) {
    warnings.push('OpenAPI spec has no paths defined');
  }

  // Check for missing info
  if (!spec.info.title) {
    warnings.push('OpenAPI spec is missing info.title');
  }
  if (!spec.info.version) {
    warnings.push('OpenAPI spec is missing info.version');
  }

  // Check for duplicate operation IDs
  const operationIds = new Set<string>();
  for (const pathItem of Object.values(spec.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = pathItem[method];
      if (operation?.operationId) {
        if (operationIds.has(operation.operationId)) {
          warnings.push(`Duplicate operationId: ${operation.operationId}`);
        }
        operationIds.add(operation.operationId);
      }
    }
  }

  return warnings;
}
