/**
 * Route extraction utilities for VeloxTS client
 *
 * Extracts REST route mappings from procedure collections, enabling
 * frontend clients to import route configuration directly from backend
 * without manual duplication.
 *
 * @module rest/routes
 */

import type { ProcedureCollection, ProcedureRecord } from '../types.js';

/**
 * Route map type - maps namespace -> procedure -> path
 *
 * @example
 * ```typescript
 * {
 *   auth: {
 *     createSession: '/auth/login',
 *     createAccount: '/auth/register',
 *   },
 *   users: {
 *     getProfile: '/users/me',
 *   },
 * }
 * ```
 */
export type RouteMap = Record<string, Record<string, string>>;

/**
 * Extracts REST route mappings from procedure collections
 *
 * Reads `.rest()` override metadata from compiled procedures and generates
 * a RouteMap that frontend clients can import directly. This eliminates
 * the need to manually duplicate route mappings between backend and frontend.
 *
 * Only procedures with explicit `.rest({ path: '...' })` overrides are included.
 * Procedures using naming conventions (getUser, listUsers, etc.) don't need
 * explicit mappings since the client infers their paths automatically.
 *
 * @param collections - Array of procedure collections to extract routes from
 * @returns RouteMap object with namespace -> procedure -> path mappings
 *
 * @example
 * ```typescript
 * // Backend: api/index.ts
 * import { extractRoutes } from '@veloxts/router';
 * import { authProcedures } from './procedures/auth.js';
 * import { userProcedures } from './procedures/users.js';
 *
 * // Export for frontend
 * export const routes = extractRoutes([authProcedures, userProcedures]);
 * export type AppRouter = typeof router;
 *
 * // Frontend: main.tsx
 * import { routes } from '../../api/src/index.js';
 * import type { AppRouter } from '../../api/src/index.js';
 *
 * <VeloxProvider<AppRouter> config={{ baseUrl: '/api', routes }}>
 * ```
 */
export function extractRoutes(collections: ProcedureCollection[]): RouteMap {
  const routes: RouteMap = {};

  for (const collection of collections) {
    const namespaceRoutes: Record<string, string> = {};

    for (const [procedureName, procedure] of Object.entries(collection.procedures)) {
      // Only include procedures with explicit .rest() path overrides
      if (procedure.restOverride?.path) {
        namespaceRoutes[procedureName] = procedure.restOverride.path;
      }
    }

    // Only add namespace if it has custom routes
    if (Object.keys(namespaceRoutes).length > 0) {
      routes[collection.namespace] = namespaceRoutes;
    }
  }

  return routes;
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
