/**
 * Collection Registry
 *
 * Tracks procedure collections and their effective prefixes as they are
 * registered via `rest()`. Enables auto-discovery by the swagger plugin
 * so users don't have to manually pass collections.
 *
 * @module rest/registry
 */

import type { ProcedureCollection } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A procedure collection paired with its effective route prefix
 */
export interface RegisteredCollection {
  readonly collection: ProcedureCollection;
  readonly prefix: string;
}

// ============================================================================
// Module-level Registry
// ============================================================================

const registry: RegisteredCollection[] = [];

/**
 * Register one or more procedure collections with their effective prefix
 *
 * Called internally by `registerRestRoutes()` after routes are mounted.
 *
 * @param collections - Procedure collections being registered
 * @param prefix - The effective route prefix (e.g., '/api', '/loterie')
 */
export function registerCollections(
  collections: readonly ProcedureCollection[],
  prefix: string
): void {
  for (const collection of collections) {
    registry.push({ collection, prefix });
  }
}

/**
 * Get all registered collections with their prefixes
 *
 * Used by `swaggerPlugin` for auto-discovery when no explicit
 * `collections` option is provided.
 */
export function getRegisteredCollections(): readonly RegisteredCollection[] {
  return registry;
}

/**
 * Clear the collection registry
 *
 * Intended for test isolation — call in `beforeEach` / `afterEach`.
 */
export function clearCollectionRegistry(): void {
  registry.length = 0;
}
