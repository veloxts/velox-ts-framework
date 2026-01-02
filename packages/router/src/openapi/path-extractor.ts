/**
 * Path Extractor
 *
 * Utilities for parsing and converting route paths between Fastify/Express format
 * and OpenAPI format.
 *
 * @module @veloxts/router/openapi/path-extractor
 */

import type { JSONSchema, OpenAPIParameter, ParameterIn } from './types.js';

// ============================================================================
// Path Conversion
// ============================================================================

/**
 * Regex pattern for path parameters in Express/Fastify format
 * Matches :paramName
 */
const PATH_PARAM_REGEX = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;

/**
 * Converts a path from Express/Fastify format to OpenAPI format
 *
 * @param path - Path in Express/Fastify format (e.g., '/users/:id')
 * @returns Path in OpenAPI format (e.g., '/users/{id}')
 *
 * @example
 * ```typescript
 * convertToOpenAPIPath('/users/:id')
 * // '/users/{id}'
 *
 * convertToOpenAPIPath('/posts/:postId/comments/:id')
 * // '/posts/{postId}/comments/{id}'
 * ```
 */
export function convertToOpenAPIPath(path: string): string {
  return path.replace(PATH_PARAM_REGEX, '{$1}');
}

/**
 * Converts a path from OpenAPI format to Express/Fastify format
 *
 * @param path - Path in OpenAPI format (e.g., '/users/{id}')
 * @returns Path in Express/Fastify format (e.g., '/users/:id')
 */
export function convertFromOpenAPIPath(path: string): string {
  return path.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, ':$1');
}

// ============================================================================
// Path Parameter Extraction
// ============================================================================

/**
 * Extracts parameter names from a path
 *
 * @param path - Path in Express/Fastify format
 * @returns Array of parameter names
 *
 * @example
 * ```typescript
 * extractPathParamNames('/users/:id')
 * // ['id']
 *
 * extractPathParamNames('/posts/:postId/comments/:id')
 * // ['postId', 'id']
 * ```
 */
export function extractPathParamNames(path: string): string[] {
  const matches = [...path.matchAll(PATH_PARAM_REGEX)];
  return matches.map((match) => match[1]);
}

/**
 * Parses path parameters into OpenAPI Parameter objects
 *
 * @param path - Path in Express/Fastify format
 * @param schemas - Optional schemas for parameters (keyed by param name)
 * @returns Array of OpenAPI Parameter objects
 *
 * @example
 * ```typescript
 * parsePathParameters('/users/:id')
 * // [{
 * //   name: 'id',
 * //   in: 'path',
 * //   required: true,
 * //   schema: { type: 'string' }
 * // }]
 * ```
 */
export function parsePathParameters(
  path: string,
  schemas?: Record<string, JSONSchema>
): OpenAPIParameter[] {
  const paramNames = extractPathParamNames(path);

  return paramNames.map((name) => ({
    name,
    in: 'path' as ParameterIn,
    required: true,
    schema: schemas?.[name] ?? { type: 'string' },
  }));
}

/**
 * Checks if a path has any parameters
 *
 * @param path - Path to check
 * @returns True if path contains parameters
 */
export function hasPathParameters(path: string): boolean {
  return PATH_PARAM_REGEX.test(path);
}

// ============================================================================
// Query Parameter Extraction
// ============================================================================

/**
 * Options for extracting query parameters
 */
export interface QueryParamExtractionOptions {
  /**
   * Parameter names to exclude (e.g., path parameters)
   */
  exclude?: string[];

  /**
   * Default required state for parameters
   * @default false
   */
  defaultRequired?: boolean;
}

/**
 * Extracts query parameters from a JSON Schema
 *
 * Converts object schema properties to OpenAPI query parameters.
 * Excludes properties that are path parameters.
 *
 * @param schema - JSON Schema representing input
 * @param options - Extraction options
 * @returns Array of OpenAPI Parameter objects
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     id: { type: 'string' },
 *     page: { type: 'integer' },
 *     limit: { type: 'integer' }
 *   },
 *   required: ['id']
 * };
 *
 * extractQueryParameters(schema, { exclude: ['id'] })
 * // [
 * //   { name: 'page', in: 'query', required: false, schema: { type: 'integer' } },
 * //   { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } }
 * // ]
 * ```
 */
export function extractQueryParameters(
  schema: JSONSchema | undefined,
  options: QueryParamExtractionOptions = {}
): OpenAPIParameter[] {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return [];
  }

  const { exclude = [], defaultRequired = false } = options;
  const properties = schema.properties as Record<string, JSONSchema>;
  const required = new Set((schema.required as string[]) ?? []);

  const params: OpenAPIParameter[] = [];

  for (const [name, propSchema] of Object.entries(properties)) {
    // Skip excluded properties (usually path parameters)
    if (exclude.includes(name)) {
      continue;
    }

    params.push({
      name,
      in: 'query',
      required: required.has(name) || defaultRequired,
      description: propSchema.description,
      schema: propSchema,
    });
  }

  return params;
}

// ============================================================================
// Combined Parameter Building
// ============================================================================

/**
 * Options for building all parameters
 */
export interface BuildParametersOptions {
  /**
   * Route path (for extracting path parameters)
   */
  path: string;

  /**
   * HTTP method
   */
  method: string;

  /**
   * Input schema (for query/body parameters)
   */
  inputSchema?: JSONSchema;

  /**
   * Custom schemas for path parameters
   */
  pathParamSchemas?: Record<string, JSONSchema>;
}

/**
 * Result of building parameters
 */
export interface BuildParametersResult {
  /**
   * Path parameters extracted from route
   */
  pathParams: OpenAPIParameter[];

  /**
   * Query parameters (for GET/DELETE)
   */
  queryParams: OpenAPIParameter[];

  /**
   * Names of path parameters (for excluding from body)
   */
  pathParamNames: string[];
}

/**
 * Builds all parameter types for a route
 *
 * @param options - Build options
 * @returns Path and query parameters
 *
 * @example
 * ```typescript
 * const result = buildParameters({
 *   path: '/users/:id',
 *   method: 'GET',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       id: { type: 'string' },
 *       include: { type: 'string' }
 *     }
 *   }
 * });
 *
 * // result.pathParams = [{ name: 'id', in: 'path', ... }]
 * // result.queryParams = [{ name: 'include', in: 'query', ... }]
 * // result.pathParamNames = ['id']
 * ```
 */
export function buildParameters(options: BuildParametersOptions): BuildParametersResult {
  const { path, method, inputSchema, pathParamSchemas } = options;

  // Extract path parameters
  const pathParamNames = extractPathParamNames(path);
  const pathParams = parsePathParameters(path, pathParamSchemas);

  // Extract query parameters for GET and DELETE
  let queryParams: OpenAPIParameter[] = [];
  if (method === 'GET' || method === 'DELETE') {
    queryParams = extractQueryParameters(inputSchema, {
      exclude: pathParamNames,
    });
  }

  return {
    pathParams,
    queryParams,
    pathParamNames,
  };
}

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Joins path segments, handling leading/trailing slashes
 *
 * @param segments - Path segments to join
 * @returns Joined path
 */
export function joinPaths(...segments: string[]): string {
  return (
    '/' +
    segments
      .map((s) => s.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/')
  );
}

/**
 * Normalizes a path by removing duplicate slashes and ensuring leading slash
 *
 * @param path - Path to normalize
 * @returns Normalized path
 */
export function normalizePath(path: string): string {
  // Remove duplicate slashes
  let normalized = path.replace(/\/+/g, '/');

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  // Remove trailing slash (unless it's just '/')
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Extracts the resource name from a path
 *
 * @param path - Path to extract from
 * @returns Resource name (last non-parameter segment)
 *
 * @example
 * ```typescript
 * extractResourceFromPath('/api/users/:id')
 * // 'users'
 *
 * extractResourceFromPath('/api/posts/:postId/comments/:id')
 * // 'comments'
 * ```
 */
export function extractResourceFromPath(path: string): string | undefined {
  const segments = path.split('/').filter(Boolean);

  // Find last non-parameter segment
  for (let i = segments.length - 1; i >= 0; i--) {
    if (!segments[i].startsWith(':') && !segments[i].startsWith('{')) {
      return segments[i];
    }
  }

  return undefined;
}
