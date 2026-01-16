/**
 * Route extraction utilities for VeloxTS client
 *
 * Extracts REST route mappings from procedure collections, enabling
 * frontend clients to import route configuration directly from backend
 * without manual duplication.
 *
 * @module rest/routes
 */

import type { HttpMethod, ProcedureCollection, ProcedureRecord } from '../types.js';
import { buildRestPath, parseNamingConvention } from './naming.js';

/**
 * A single route entry with method, path, and procedure kind
 *
 * Matches the RouteEntry interface in @veloxts/client
 */
export interface RouteEntry {
  method: HttpMethod;
  path: string;
  kind: 'query' | 'mutation';
}

/**
 * Route map type - maps namespace -> procedure -> RouteEntry
 *
 * @example
 * ```typescript
 * {
 *   auth: {
 *     createSession: { method: 'POST', path: '/auth/login', kind: 'mutation' },
 *     createAccount: { method: 'POST', path: '/auth/register', kind: 'mutation' },
 *   },
 *   users: {
 *     getProfile: { method: 'GET', path: '/users/me', kind: 'query' },
 *     listUsers: { method: 'GET', path: '/users', kind: 'query' },
 *   },
 * }
 * ```
 */
export type RouteMap = Record<string, Record<string, RouteEntry>>;

/**
 * Extracts REST route mappings from procedure collections
 *
 * Generates a RouteMap with method, path, and kind for ALL procedures,
 * enabling frontend clients to:
 * 1. Know the correct REST endpoint for each procedure
 * 2. Override naming convention heuristics with explicit `kind` field
 *
 * For procedures with `.rest()` overrides, uses the specified path/method.
 * For procedures following naming conventions, infers method/path automatically.
 * For non-conventional procedures (like `health`), uses POST as default method.
 *
 * @param collections - Array of procedure collections to extract routes from
 * @returns RouteMap with namespace -> procedure -> { method, path, kind } mappings
 *
 * @example
 * ```typescript
 * // Backend: api/index.ts
 * import { extractRoutes } from '@veloxts/router';
 * import { authProcedures } from './procedures/auth.js';
 * import { userProcedures } from './procedures/users.js';
 *
 * // Export for frontend (includes kind for type detection)
 * export const routes = extractRoutes([authProcedures, userProcedures]);
 * export type AppRouter = typeof router;
 *
 * // Frontend: api.ts
 * import { createVeloxHooks } from '@veloxts/client/react';
 * import { routes } from '../../api/src/index.js';
 * import type { AppRouter } from '../../api/src/index.js';
 *
 * // Routes provide explicit kind for non-conventional procedure names
 * export const api = createVeloxHooks<AppRouter>({ routes });
 * ```
 */
export function extractRoutes(collections: ProcedureCollection[]): RouteMap {
  const routes: RouteMap = {};

  for (const collection of collections) {
    const namespaceRoutes: Record<string, RouteEntry> = {};

    for (const [procedureName, procedure] of Object.entries(collection.procedures)) {
      const kind = procedure.type;

      // Check for explicit .rest() override first
      if (procedure.restOverride?.path) {
        const method = procedure.restOverride.method ?? inferMethodFromKind(kind);
        namespaceRoutes[procedureName] = {
          method,
          path: procedure.restOverride.path,
          kind,
        };
        continue;
      }

      // Try to infer from naming convention
      const mapping = parseNamingConvention(procedureName, kind);
      if (mapping) {
        namespaceRoutes[procedureName] = {
          method: mapping.method,
          path: buildRestPath(collection.namespace, mapping),
          kind,
        };
        continue;
      }

      // Fallback for non-conventional names: use namespace path with POST for mutations
      namespaceRoutes[procedureName] = {
        method: inferMethodFromKind(kind),
        path: `/${collection.namespace}`,
        kind,
      };
    }

    // Always add namespace (all procedures are included now)
    if (Object.keys(namespaceRoutes).length > 0) {
      routes[collection.namespace] = namespaceRoutes;
    }
  }

  return routes;
}

/**
 * Infer HTTP method from procedure kind
 * @internal
 */
function inferMethodFromKind(kind: 'query' | 'mutation'): HttpMethod {
  return kind === 'query' ? 'GET' : 'POST';
}

/**
 * Type-level route extraction from a router type
 *
 * Extracts route paths from procedure restOverride metadata at the type level.
 * This enables TypeScript to infer the exact route map shape from the router type.
 *
 * @template TRouter - The router type containing procedure collections
 *
 * @example
 * ```typescript
 * type MyRoutes = ExtractRoutesType<AppRouter>;
 * // Infers: { auth: { createSession: '/auth/login', ... }, ... }
 * ```
 */
export type ExtractRoutesType<TRouter> = {
  [K in keyof TRouter]: TRouter[K] extends ProcedureCollection<infer P>
    ? ExtractNamespaceRoutes<P>
    : never;
};

/**
 * Helper type to extract routes from a procedure record
 * @internal
 */
type ExtractNamespaceRoutes<P extends ProcedureRecord> = {
  [PK in keyof P as P[PK] extends { restOverride: { path: string } } ? PK : never]: P[PK] extends {
    restOverride: { path: infer Path };
  }
    ? Path
    : never;
};
