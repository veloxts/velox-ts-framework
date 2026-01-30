/**
 * Naming conventions for procedure-to-REST mapping
 *
 * Provides shared constants for mapping procedure names to HTTP methods
 * and REST paths. Used by both @veloxts/router and @veloxts/client.
 *
 * @module naming
 */

// ============================================================================
// HTTP Method Types
// ============================================================================

/**
 * HTTP methods supported by the REST adapter
 *
 * Full REST support: GET, POST, PUT, PATCH, DELETE
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ============================================================================
// Procedure Method Mapping
// ============================================================================

/**
 * Maps procedure naming conventions to HTTP methods
 *
 * This is the single source of truth for the naming convention system.
 * Both @veloxts/router and @veloxts/client import from here to ensure
 * consistent behavior.
 *
 * @example
 * - getUser -> GET
 * - listUsers -> GET
 * - createUser -> POST
 * - updateUser -> PUT
 * - patchUser -> PATCH
 * - deleteUser -> DELETE
 */
export const PROCEDURE_METHOD_MAP: Record<string, HttpMethod> = {
  get: 'GET',
  list: 'GET',
  find: 'GET',
  create: 'POST',
  add: 'POST',
  update: 'PUT',
  edit: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  remove: 'DELETE',
} as const;

/**
 * Infers HTTP method from procedure name
 *
 * @param procedureName - The name of the procedure (e.g., 'getUser', 'createPost')
 * @returns The inferred HTTP method
 *
 * @example
 * ```typescript
 * inferMethodFromName('getUser');     // 'GET'
 * inferMethodFromName('createPost');  // 'POST'
 * inferMethodFromName('updateUser');  // 'PUT'
 * inferMethodFromName('someAction');  // 'POST' (default for mutations)
 * ```
 */
export function inferMethodFromName(procedureName: string): HttpMethod {
  for (const [prefix, method] of Object.entries(PROCEDURE_METHOD_MAP)) {
    if (procedureName.startsWith(prefix)) {
      return method;
    }
  }

  // Default to POST for mutations (conservative default)
  return 'POST';
}

/**
 * Checks if a procedure name indicates a query operation
 *
 * Query operations are read-only and map to GET requests.
 *
 * @param procedureName - The name of the procedure
 * @returns true if the procedure is a query operation
 *
 * @example
 * ```typescript
 * isQueryProcedure('getUser');      // true
 * isQueryProcedure('listUsers');    // true
 * isQueryProcedure('findPosts');    // true
 * isQueryProcedure('createUser');   // false
 * ```
 */
export function isQueryProcedure(procedureName: string): boolean {
  return (
    procedureName.startsWith('get') ||
    procedureName.startsWith('list') ||
    procedureName.startsWith('find')
  );
}
