/**
 * Router Utility Functions
 *
 * Helpers for creating type-safe router definitions from procedure collections.
 *
 * @module router-utils
 */

import type { ProcedureCollection, ProcedureRecord } from './types.js';

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Extracts the namespace from a ProcedureCollection as a literal type
 */
type ExtractNamespace<T> = T extends ProcedureCollection<infer _P> & { readonly namespace: infer N }
  ? N extends string
    ? N
    : never
  : never;

/**
 * Creates a union of namespaces from an array of ProcedureCollections
 */
type CollectionNamespaces<T extends readonly ProcedureCollection[]> = {
  [K in keyof T]: ExtractNamespace<T[K]>;
}[number];

/**
 * Maps namespaces to their corresponding ProcedureCollections
 */
type RouterFromCollections<T extends readonly ProcedureCollection[]> = {
  [K in CollectionNamespaces<T>]: Extract<T[number], { namespace: K }>;
};

/**
 * Result type from createRouter
 */
export interface RouterResult<T extends readonly ProcedureCollection[]> {
  /** Array of procedure collections for routing */
  readonly collections: T;
  /** Object mapping namespaces to procedure collections */
  readonly router: RouterFromCollections<T>;
}

// ============================================================================
// Router Creation
// ============================================================================

/**
 * Creates both collections array and router object from procedure collections.
 *
 * This helper eliminates the redundancy of defining both `collections` and `router`
 * separately. The router object is automatically keyed by each collection's namespace.
 *
 * @param collections - Procedure collections to include in the router
 * @returns Object containing both `collections` array and `router` object
 *
 * @example
 * ```typescript
 * import { createRouter, extractRoutes } from '@veloxts/router';
 * import { healthProcedures } from './procedures/health.js';
 * import { userProcedures } from './procedures/users.js';
 *
 * // Before (redundant):
 * // export const collections = [healthProcedures, userProcedures];
 * // export const router = {
 * //   health: healthProcedures,
 * //   users: userProcedures,
 * // };
 *
 * // After (DRY):
 * export const { collections, router } = createRouter(
 *   healthProcedures,
 *   userProcedures
 * );
 *
 * export type AppRouter = typeof router;
 * export const routes = extractRoutes(collections);
 * ```
 */
export function createRouter<T extends ProcedureCollection<ProcedureRecord>[]>(
  ...collections: T
): RouterResult<T> {
  const router = Object.fromEntries(
    collections.map((collection) => [collection.namespace, collection])
  ) as RouterFromCollections<T>;

  return {
    collections: collections as unknown as T,
    router,
  };
}

/**
 * Creates a router object from procedure collections.
 *
 * This is an alternative to `createRouter` when you only need the router object
 * and not the collections array. Useful for frontend-only type imports.
 *
 * @param collections - Procedure collections to include in the router
 * @returns Object mapping namespaces to procedure collections
 *
 * @example
 * ```typescript
 * import { toRouter } from '@veloxts/router';
 *
 * export const router = toRouter(healthProcedures, userProcedures);
 * // Result: { health: healthProcedures, users: userProcedures }
 *
 * export type AppRouter = typeof router;
 * ```
 */
export function toRouter<T extends ProcedureCollection<ProcedureRecord>[]>(
  ...collections: T
): RouterFromCollections<T> {
  return Object.fromEntries(
    collections.map((collection) => [collection.namespace, collection])
  ) as RouterFromCollections<T>;
}
