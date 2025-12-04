/**
 * REST naming convention parser
 *
 * Parses procedure names to infer HTTP methods and paths following
 * convention-over-configuration principles.
 *
 * @module rest/naming
 */

import type { HttpMethod, ProcedureType } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of parsing a procedure name into REST route info
 */
export interface RestMapping {
  /** HTTP method inferred from naming convention */
  readonly method: HttpMethod;
  /** Path pattern (e.g., '/', '/:id') */
  readonly path: string;
  /** Whether the path includes an :id parameter */
  readonly hasIdParam: boolean;
}

/**
 * Naming convention pattern definition
 */
interface NamingPattern {
  /** Regex to match procedure name prefix */
  readonly pattern: RegExp;
  /** HTTP method for this pattern */
  readonly method: HttpMethod;
  /** Whether this pattern expects an ID parameter */
  readonly hasIdParam: boolean;
  /** Required procedure type (query or mutation) */
  readonly procedureType: ProcedureType;
}

// ============================================================================
// Naming Patterns
// ============================================================================

/**
 * MVP (v0.1.0) naming patterns - GET and POST only
 *
 * Pattern matching is done by prefix:
 * - get<Resource>    -> GET /:id    (single resource)
 * - list<Resources>  -> GET /       (collection)
 * - find<Resource>   -> GET /       (search/filter)
 * - create<Resource> -> POST /      (create new)
 * - add<Resource>    -> POST /      (alias for create)
 *
 * v1.1+ will add:
 * - update<Resource> -> PUT /:id
 * - delete<Resource> -> DELETE /:id
 */
const MVP_NAMING_PATTERNS: readonly NamingPattern[] = [
  // GET with ID - single resource retrieval
  {
    pattern: /^get([A-Z][a-zA-Z]*)$/,
    method: 'GET',
    hasIdParam: true,
    procedureType: 'query',
  },
  // GET without ID - list/collection
  {
    pattern: /^list([A-Z][a-zA-Z]*)$/,
    method: 'GET',
    hasIdParam: false,
    procedureType: 'query',
  },
  // GET without ID - search/find
  {
    pattern: /^find([A-Z][a-zA-Z]*)$/,
    method: 'GET',
    hasIdParam: false,
    procedureType: 'query',
  },
  // POST - create resource
  {
    pattern: /^create([A-Z][a-zA-Z]*)$/,
    method: 'POST',
    hasIdParam: false,
    procedureType: 'mutation',
  },
  // POST - add resource (alias)
  {
    pattern: /^add([A-Z][a-zA-Z]*)$/,
    method: 'POST',
    hasIdParam: false,
    procedureType: 'mutation',
  },
] as const;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse a procedure name into REST mapping using naming conventions
 *
 * @param name - Procedure name (e.g., 'getUser', 'listUsers', 'createUser')
 * @param type - Procedure type ('query' or 'mutation')
 * @returns REST mapping if convention matches, undefined otherwise
 *
 * @example
 * ```typescript
 * parseNamingConvention('getUser', 'query')
 * // Returns: { method: 'GET', path: '/:id', hasIdParam: true }
 *
 * parseNamingConvention('listUsers', 'query')
 * // Returns: { method: 'GET', path: '/', hasIdParam: false }
 *
 * parseNamingConvention('createUser', 'mutation')
 * // Returns: { method: 'POST', path: '/', hasIdParam: false }
 *
 * parseNamingConvention('doSomething', 'mutation')
 * // Returns: undefined (no convention matches)
 * ```
 */
export function parseNamingConvention(name: string, type: ProcedureType): RestMapping | undefined {
  for (const pattern of MVP_NAMING_PATTERNS) {
    // Check if procedure type matches
    if (pattern.procedureType !== type) {
      continue;
    }

    // Check if name matches pattern
    const match = pattern.pattern.exec(name);
    if (match) {
      return {
        method: pattern.method,
        path: pattern.hasIdParam ? '/:id' : '/',
        hasIdParam: pattern.hasIdParam,
      };
    }
  }

  // No convention matched
  return undefined;
}

/**
 * Build the full REST path from namespace and mapping
 *
 * @param namespace - Resource namespace (e.g., 'users')
 * @param mapping - REST mapping from parseNamingConvention
 * @returns Full path (e.g., '/users/:id', '/users')
 *
 * @example
 * ```typescript
 * buildRestPath('users', { method: 'GET', path: '/:id', hasIdParam: true })
 * // Returns: '/users/:id'
 *
 * buildRestPath('users', { method: 'GET', path: '/', hasIdParam: false })
 * // Returns: '/users'
 * ```
 */
export function buildRestPath(namespace: string, mapping: RestMapping): string {
  const basePath = `/${namespace}`;

  // If path is just '/', return the base path without trailing slash
  if (mapping.path === '/') {
    return basePath;
  }

  // Otherwise append the path (e.g., '/:id')
  return `${basePath}${mapping.path}`;
}

/**
 * Infer the resource name from a procedure name
 *
 * @param name - Procedure name (e.g., 'getUser', 'listUsers')
 * @returns Resource name or undefined if cannot be inferred
 *
 * @example
 * ```typescript
 * inferResourceName('getUser')     // 'User'
 * inferResourceName('listUsers')   // 'Users'
 * inferResourceName('doSomething') // undefined
 * ```
 */
export function inferResourceName(name: string): string | undefined {
  for (const pattern of MVP_NAMING_PATTERNS) {
    const match = pattern.pattern.exec(name);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Check if a procedure name follows any known naming convention
 *
 * @param name - Procedure name to check
 * @param type - Procedure type
 * @returns true if the name follows a convention
 */
export function followsNamingConvention(name: string, type: ProcedureType): boolean {
  return parseNamingConvention(name, type) !== undefined;
}
