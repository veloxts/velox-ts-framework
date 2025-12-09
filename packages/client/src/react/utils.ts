/**
 * Utility functions for React Query integration
 *
 * Provides query key builders and cache invalidation helpers
 * for consistent and predictable caching behavior.
 *
 * @module @veloxts/client/react/utils
 */

import type { QueryClient } from '@tanstack/react-query';

import type { VeloxQueryKey } from './types.js';

// ============================================================================
// Query Key Builders
// ============================================================================

/**
 * Builds a stable query key for React Query
 *
 * Query keys are structured as: [namespace, procedureName, input?]
 * This enables efficient cache invalidation by namespace or procedure.
 *
 * The key structure follows React Query best practices:
 * - Keys are arrays for hierarchical invalidation
 * - Input is serialized for stable identity
 *
 * @param namespace - The procedure namespace (e.g., 'users')
 * @param procedureName - The procedure name (e.g., 'getUser')
 * @param input - Optional input parameters
 * @returns A stable query key array
 *
 * @example
 * ```typescript
 * // Query with no input
 * buildQueryKey('health', 'check');
 * // => ['health', 'check']
 *
 * // Query with object input
 * buildQueryKey('users', 'getUser', { id: '123' });
 * // => ['users', 'getUser', { id: '123' }]
 *
 * // Query with primitive input (wrapped)
 * buildQueryKey('users', 'getCount', 10);
 * // => ['users', 'getCount', { value: 10 }]
 * ```
 */
export function buildQueryKey(
  namespace: string,
  procedureName: string,
  input?: unknown
): VeloxQueryKey {
  if (input === undefined || input === null) {
    return [namespace, procedureName] as const;
  }

  // For objects, include directly in key for proper caching
  if (typeof input === 'object') {
    return [namespace, procedureName, input as Record<string, unknown>] as const;
  }

  // For primitives, wrap in object to maintain consistent key structure
  return [namespace, procedureName, { value: input }] as const;
}

// ============================================================================
// Cache Invalidation Helpers
// ============================================================================

/**
 * Invalidates all queries for a namespace
 *
 * This is useful after mutations that may affect multiple resources
 * within the same namespace.
 *
 * @param queryClient - The React Query client instance
 * @param namespace - The namespace to invalidate (e.g., 'users')
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // After deleting a user, invalidate all user queries
 * await invalidateNamespace(queryClient, 'users');
 * ```
 */
export async function invalidateNamespace(
  queryClient: QueryClient,
  namespace: string
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: [namespace] });
}

/**
 * Invalidates all queries for a specific procedure
 *
 * This is useful when you want to refetch all instances of a specific
 * query without affecting other queries in the same namespace.
 *
 * @param queryClient - The React Query client instance
 * @param namespace - The procedure namespace (e.g., 'users')
 * @param procedureName - The procedure name (e.g., 'getUser')
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // After updating a user, invalidate all getUser queries
 * await invalidateProcedure(queryClient, 'users', 'getUser');
 * ```
 */
export async function invalidateProcedure(
  queryClient: QueryClient,
  namespace: string,
  procedureName: string
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: [namespace, procedureName] });
}

/**
 * Invalidates a specific query by its exact key
 *
 * This is useful when you know the exact input and want to invalidate
 * only that specific cached query.
 *
 * @param queryClient - The React Query client instance
 * @param namespace - The procedure namespace (e.g., 'users')
 * @param procedureName - The procedure name (e.g., 'getUser')
 * @param input - The exact input used in the query
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // After updating user 123, invalidate only that specific query
 * await invalidateQuery(queryClient, 'users', 'getUser', { id: '123' });
 * ```
 */
export async function invalidateQuery(
  queryClient: QueryClient,
  namespace: string,
  procedureName: string,
  input?: unknown
): Promise<void> {
  const queryKey = buildQueryKey(namespace, procedureName, input);
  await queryClient.invalidateQueries({ queryKey });
}

// ============================================================================
// Cache Data Accessors
// ============================================================================

/**
 * Gets cached data for a specific query
 *
 * Useful for optimistic updates where you need the current cached value.
 *
 * @param queryClient - The React Query client instance
 * @param namespace - The procedure namespace
 * @param procedureName - The procedure name
 * @param input - The query input
 * @returns The cached data or undefined if not cached
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // Get current cached user before optimistic update
 * const previousUser = getQueryData<User>(
 *   queryClient,
 *   'users',
 *   'getUser',
 *   { id: '123' }
 * );
 * ```
 */
export function getQueryData<TData>(
  queryClient: QueryClient,
  namespace: string,
  procedureName: string,
  input?: unknown
): TData | undefined {
  const queryKey = buildQueryKey(namespace, procedureName, input);
  return queryClient.getQueryData<TData>(queryKey);
}

/**
 * Sets cached data for a specific query
 *
 * Useful for optimistic updates where you want to update the cache
 * immediately before the mutation completes.
 *
 * @param queryClient - The React Query client instance
 * @param namespace - The procedure namespace
 * @param procedureName - The procedure name
 * @param input - The query input
 * @param data - The data to cache
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // Optimistically update user in cache
 * setQueryData<User>(
 *   queryClient,
 *   'users',
 *   'getUser',
 *   { id: '123' },
 *   { ...previousUser, name: 'New Name' }
 * );
 * ```
 */
export function setQueryData<TData>(
  queryClient: QueryClient,
  namespace: string,
  procedureName: string,
  input: unknown,
  data: TData
): void {
  const queryKey = buildQueryKey(namespace, procedureName, input);
  queryClient.setQueryData<TData>(queryKey, data);
}
