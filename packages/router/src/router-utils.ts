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
 * Extracts the namespace literal type from a ProcedureCollection
 *
 * With the updated ProcedureCollection<TNamespace, TProcedures> signature,
 * TNamespace is now a literal type (e.g., 'users', 'auth') rather than just string.
 */
type ExtractNamespace<T> = T extends ProcedureCollection<infer N, infer _P> ? N : never;

/**
 * Creates a union of namespaces from an array of ProcedureCollections
 */
type CollectionNamespaces<T extends readonly ProcedureCollection<string, ProcedureRecord>[]> = {
  [K in keyof T]: ExtractNamespace<T[K]>;
}[number];

/**
 * Maps namespaces to their corresponding ProcedureCollections
 *
 * The Extract utility type now works correctly because TNamespace is a literal type,
 * allowing proper narrowing from `'users' | 'auth'` to the specific `'users'` collection.
 */
type RouterFromCollections<T extends readonly ProcedureCollection<string, ProcedureRecord>[]> = {
  [K in CollectionNamespaces<T>]: Extract<T[number], { namespace: K }>;
};

/**
 * Result type from createRouter
 */
export interface RouterResult<T extends readonly ProcedureCollection<string, ProcedureRecord>[]> {
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
export function createRouter<T extends ProcedureCollection<string, ProcedureRecord>[]>(
  ...collections: T
): RouterResult<T> {
  const router = Object.fromEntries(
    collections.map((collection) => [collection.namespace, collection])
  ) as RouterFromCollections<T>;

  return {
    // Cast required: rest params are typed as T[] but we need to preserve
    // the exact tuple type T for proper namespace inference in RouterResult
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
export function toRouter<T extends ProcedureCollection<string, ProcedureRecord>[]>(
  ...collections: T
): RouterFromCollections<T> {
  return Object.fromEntries(
    collections.map((collection) => [collection.namespace, collection])
  ) as RouterFromCollections<T>;
}
