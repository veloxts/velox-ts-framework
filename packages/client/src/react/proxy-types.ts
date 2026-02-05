/**
 * Type definitions for tRPC-style proxy hooks
 *
 * Provides type utilities for the new `createVeloxHooks` API that enables
 * full IDE autocomplete through a proxy-based hook system.
 *
 * @module @veloxts/client/react/proxy-types
 */

import type {
  QueryClient,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
  UseSuspenseQueryOptions,
  UseSuspenseQueryResult,
} from '@tanstack/react-query';

import type {
  ClientFromRouter,
  ClientProcedure,
  ProcedureCollection,
  ProcedureRecord,
  RouteMap,
} from '../types.js';
import type { VeloxQueryKey } from './types.js';

// ============================================================================
// Query Procedure Interface
// ============================================================================

/**
 * Hook methods available for query procedures
 *
 * Query procedures (get*, list*, find*) get these methods:
 * - useQuery - Main hook for fetching data
 * - useSuspenseQuery - Suspense-enabled variant
 * - getQueryKey - Get the query key for manual cache operations
 * - invalidate - Invalidate cached queries
 * - prefetch - Prefetch data into cache
 * - getData - Read from cache
 * - setData - Write to cache
 *
 * @template TInput - The procedure input type
 * @template TOutput - The procedure output type
 */
export interface VeloxQueryProcedure<TInput, TOutput> {
  /**
   * React Query hook for fetching data
   *
   * @param input - Procedure input (fully typed, optional if input schema is optional)
   * @param options - React Query options (queryKey and queryFn auto-provided)
   * @returns UseQueryResult with typed data
   *
   * @example
   * ```tsx
   * // Required input
   * const { data, isLoading } = api.users.getUser.useQuery({ id: userId });
   *
   * // Optional input - can omit the argument entirely
   * const { data } = api.users.listUsers.useQuery();
   * ```
   */
  useQuery(
    ...args: undefined extends TInput
      ? [input?: TInput, options?: Omit<UseQueryOptions<TOutput, Error>, 'queryKey' | 'queryFn'>]
      : [input: TInput, options?: Omit<UseQueryOptions<TOutput, Error>, 'queryKey' | 'queryFn'>]
  ): UseQueryResult<TOutput, Error>;

  /**
   * Suspense-enabled query hook
   *
   * Throws a promise for Suspense boundaries to catch.
   * Data is guaranteed to be available when component renders.
   *
   * @example
   * ```tsx
   * // Required input
   * const { data: user } = api.users.getUser.useSuspenseQuery({ id: userId });
   *
   * // Optional input - can omit the argument entirely
   * const { data } = api.users.listUsers.useSuspenseQuery();
   * ```
   */
  useSuspenseQuery(
    ...args: undefined extends TInput
      ? [
          input?: TInput,
          options?: Omit<UseSuspenseQueryOptions<TOutput, Error>, 'queryKey' | 'queryFn'>,
        ]
      : [
          input: TInput,
          options?: Omit<UseSuspenseQueryOptions<TOutput, Error>, 'queryKey' | 'queryFn'>,
        ]
  ): UseSuspenseQueryResult<TOutput, Error>;

  /**
   * Get the query key for this procedure + input
   *
   * Useful for manual cache operations with QueryClient.
   *
   * @param input - Optional input to include in the key
   * @returns Query key tuple: [namespace, procedureName, input?]
   *
   * @example
   * ```tsx
   * const key = api.users.getUser.getQueryKey({ id: '123' });
   * // key = ['users', 'getUser', { id: '123' }]
   * ```
   */
  getQueryKey(input?: TInput): VeloxQueryKey;

  /**
   * Invalidate queries for this procedure
   *
   * When called without input, invalidates all queries for this procedure.
   * When called with input, invalidates only the specific query.
   *
   * @param input - Optional input to narrow invalidation (unique data first)
   * @param queryClient - QueryClient instance from useQueryClient()
   *
   * @example
   * ```tsx
   * function UserProfile({ userId }: { userId: string }) {
   *   const queryClient = useQueryClient();
   *
   *   const { mutate } = api.users.updateUser.useMutation({
   *     onSuccess: () => {
   *       api.users.getUser.invalidate({ id: userId }, queryClient);
   *     },
   *   });
   *
   *   // Invalidate all queries for this procedure
   *   api.users.listUsers.invalidate(undefined, queryClient);
   * }
   * ```
   */
  invalidate(input: TInput | undefined, queryClient: QueryClient): Promise<void>;

  /**
   * Prefetch data for this procedure
   *
   * Fetches data and stores it in the cache without rendering.
   * Useful for hover-to-prefetch patterns.
   *
   * @param input - Procedure input (optional if input schema is optional)
   * @param queryClient - QueryClient instance from useQueryClient()
   *
   * @example
   * ```tsx
   * function UserList() {
   *   const queryClient = useQueryClient();
   *
   *   return (
   *     <li onMouseEnter={() => api.users.getUser.prefetch({ id: user.id }, queryClient)}>
   *       {user.name}
   *     </li>
   *   );
   * }
   * ```
   */
  prefetch(
    ...args: undefined extends TInput
      ? [input: TInput | undefined, queryClient: QueryClient]
      : [input: TInput, queryClient: QueryClient]
  ): Promise<void>;

  /**
   * Manually set cached data
   *
   * Useful for optimistic updates in mutation callbacks.
   *
   * @param input - Procedure input to identify the cache entry
   * @param data - Data to store in cache (or null to clear)
   * @param queryClient - QueryClient instance from useQueryClient()
   *
   * @example
   * ```tsx
   * function UserProfile() {
   *   const queryClient = useQueryClient();
   *
   *   const { mutate } = api.users.updateUser.useMutation({
   *     onSuccess: (updatedUser) => {
   *       api.users.getUser.setData({ id: updatedUser.id }, updatedUser, queryClient);
   *     },
   *   });
   *
   *   // Clear cache entry
   *   api.auth.getMe.setData({}, null, queryClient);
   * }
   * ```
   */
  setData(input: TInput, data: TOutput | null, queryClient: QueryClient): void;

  /**
   * Get cached data if available
   *
   * Returns undefined if not in cache.
   *
   * @param input - Procedure input to identify the cache entry
   * @param queryClient - QueryClient instance from useQueryClient()
   *
   * @example
   * ```tsx
   * function UserProfile({ userId }: { userId: string }) {
   *   const queryClient = useQueryClient();
   *
   *   const cachedUser = api.users.getUser.getData({ id: userId }, queryClient);
   * }
   * ```
   */
  getData(input: TInput, queryClient: QueryClient): TOutput | undefined;
}

// ============================================================================
// Mutation Procedure Interface
// ============================================================================

/**
 * Hook methods available for mutation procedures
 *
 * Mutation procedures (create*, update*, delete*, etc.) get this method:
 * - useMutation - Hook for mutating data
 *
 * @template TInput - The procedure input type
 * @template TOutput - The procedure output type
 */
export interface VeloxMutationProcedure<TInput, TOutput> {
  /**
   * React Query mutation hook
   *
   * @param options - React Query mutation options (mutationFn auto-provided)
   * @returns UseMutationResult with typed variables and data
   *
   * @example
   * ```tsx
   * const { mutate, isPending } = api.users.createUser.useMutation({
   *   onSuccess: (newUser) => {
   *     api.users.listUsers.invalidate();
   *   },
   * });
   *
   * // Later
   * mutate({ name: 'Alice', email: 'alice@example.com' });
   * ```
   */
  useMutation<TContext = unknown>(
    options?: VeloxMutationOptions<TOutput, TInput, TContext>
  ): UseMutationResult<TOutput, Error, TInput, TContext>;
}

// ============================================================================
// Auto-Invalidation Types
// ============================================================================

/**
 * Configuration for automatic cache invalidation after mutations
 *
 * VeloxTS automatically invalidates related queries after mutations succeed,
 * following naming conventions:
 *
 * - `create*`, `add*` → invalidates `list*`, `find*` queries
 * - `update*`, `edit*`, `patch*` → invalidates `get*` (matching ID), `list*`, `find*`
 * - `delete*`, `remove*` → invalidates `get*` (matching ID), `list*`, `find*`
 *
 * This behavior is opt-out (enabled by default) and can be customized.
 *
 * @example
 * ```tsx
 * // Auto-invalidation happens by default
 * const { mutate } = api.users.createUser.useMutation();
 *
 * // Disable auto-invalidation
 * const { mutate } = api.users.createUser.useMutation({
 *   autoInvalidate: false,
 * });
 *
 * // Customize auto-invalidation
 * const { mutate } = api.users.updateUser.useMutation({
 *   autoInvalidate: {
 *     additional: [['posts', 'listPosts']], // Also invalidate posts
 *     exclude: ['findUsers'],               // Don't invalidate findUsers
 *   },
 * });
 * ```
 */
export interface AutoInvalidationConfig {
  /**
   * Enable/disable auto-invalidation
   * @default true
   */
  enabled?: boolean;

  /**
   * Additional queries to invalidate beyond convention-based rules
   *
   * Each tuple is [namespace, procedureName, input?]
   *
   * @example
   * ```tsx
   * autoInvalidate: {
   *   additional: [
   *     ['posts', 'listPosts'],           // Invalidate all listPosts
   *     ['posts', 'getPost', { id: '1' }] // Invalidate specific post
   *   ],
   * }
   * ```
   */
  additional?: Array<readonly [string, string, unknown?]>;

  /**
   * Procedure names to exclude from auto-invalidation
   *
   * @example
   * ```tsx
   * autoInvalidate: {
   *   exclude: ['findUsers', 'getUserStats'],
   * }
   * ```
   */
  exclude?: string[];

  /**
   * Custom invalidation logic called after convention-based invalidation
   *
   * @example
   * ```tsx
   * autoInvalidate: {
   *   custom: async ({ namespace, input, invalidate }) => {
   *     await invalidate('getUserStats', input);
   *   },
   * }
   * ```
   */
  custom?: (context: InvalidationContext) => void | Promise<void>;
}

/**
 * Context passed to custom invalidation handlers
 */
export interface InvalidationContext {
  /** The namespace of the mutation (e.g., 'users') */
  namespace: string;
  /** The mutation procedure name (e.g., 'createUser') */
  procedureName: string;
  /** The input passed to the mutation */
  input: unknown;
  /** The mutation result/output */
  data: unknown;
  /** QueryClient for manual operations */
  queryClient: QueryClient;
  /** Helper to invalidate a specific query in the same namespace */
  invalidate: (procedureName: string, input?: unknown) => Promise<void>;
}

/**
 * Extended mutation options with auto-invalidation support
 *
 * Extends React Query's UseMutationOptions with VeloxTS-specific features.
 *
 * @template TOutput - The mutation output type
 * @template TInput - The mutation input type
 * @template TContext - The mutation context type (for optimistic updates)
 */
export interface VeloxMutationOptions<TOutput, TInput, TContext = unknown>
  extends Omit<UseMutationOptions<TOutput, Error, TInput, TContext>, 'mutationFn'> {
  /**
   * Configure automatic cache invalidation
   *
   * - `true` (default): Enable convention-based invalidation
   * - `false`: Disable auto-invalidation entirely
   * - `AutoInvalidationConfig`: Customize invalidation behavior
   *
   * @default true
   */
  autoInvalidate?: boolean | AutoInvalidationConfig;
}

// ============================================================================
// Procedure Type Resolution
// ============================================================================

/**
 * Resolves a procedure to its appropriate hook interface
 * based on whether it's a query or mutation
 *
 * With the TType generic parameter preserved through the procedure builder chain,
 * we can now properly discriminate between query and mutation types.
 * The ClientProcedure<TInput, TOutput, TType> captures the literal 'query' or 'mutation'
 * type, enabling accurate type resolution.
 *
 * @internal
 */
type VeloxProcedureHooks<TProcedure> =
  TProcedure extends ClientProcedure<infer TInput, infer TOutput, infer TType>
    ? TType extends 'mutation'
      ? VeloxMutationProcedure<TInput, TOutput>
      : TType extends 'query'
        ? VeloxQueryProcedure<TInput, TOutput>
        : VeloxQueryProcedure<TInput, TOutput> // Fallback for union type (shouldn't happen with proper typing)
    : never;

// ============================================================================
// Namespace and Router Types
// ============================================================================

/**
 * Maps a procedures record to hook interfaces
 *
 * Each procedure becomes a VeloxQueryProcedure or VeloxMutationProcedure
 * based on its type.
 *
 * @template TProcedures - The procedures record type
 */
export type VeloxNamespace<TProcedures extends ProcedureRecord> = {
  [K in keyof TProcedures]: VeloxProcedureHooks<TProcedures[K]>;
};

// ============================================================================
// tRPC Router Support
// ============================================================================

/**
 * Extract input type from a tRPC procedure
 */
type InferTRPCInput<T> = T extends { _def: { $types: { input: infer I } } } ? I : unknown;

/**
 * Extract output type from a tRPC procedure
 */
type InferTRPCOutput<T> = T extends { _def: { $types: { output: infer O } } } ? O : unknown;

/**
 * Determine if a tRPC procedure is a query or mutation
 */
type InferTRPCType<T> = T extends { _def: { type: infer TType } }
  ? TType extends 'query'
    ? 'query'
    : TType extends 'mutation'
      ? 'mutation'
      : 'query'
  : 'query';

/**
 * Resolve a tRPC procedure to its appropriate hook interface
 */
type VeloxTRPCProcedureHooks<TProcedure> = InferTRPCType<TProcedure> extends 'mutation'
  ? VeloxMutationProcedure<InferTRPCInput<TProcedure>, InferTRPCOutput<TProcedure>>
  : VeloxQueryProcedure<InferTRPCInput<TProcedure>, InferTRPCOutput<TProcedure>>;

/**
 * Maps a tRPC namespace to hook interfaces
 */
export type VeloxTRPCNamespace<TNamespace> = {
  [K in keyof TNamespace]: TNamespace[K] extends { _def: unknown }
    ? VeloxTRPCProcedureHooks<TNamespace[K]>
    : never;
};

// ============================================================================
// Main Hooks Type
// ============================================================================

/**
 * Maps router namespaces to their namespace hook interfaces
 *
 * This is the top-level type returned by `createVeloxHooks`.
 *
 * Supports two router shapes:
 * 1. ProcedureCollection-based (REST mode): { namespace: ProcedureCollection }
 * 2. tRPC router (tRPC mode): { namespace: { procedure: TRPCProcedure } }
 *
 * @template TRouter - The router type (collection of procedure collections or tRPC router)
 *
 * @example
 * ```typescript
 * // REST mode (ProcedureCollection)
 * type AppRouter = { users: typeof userProcedures };
 * const api = createVeloxHooks<AppRouter>();
 *
 * // tRPC mode
 * const { router } = rpc([userProcedures] as const);
 * export type AppRouter = typeof router;
 * const api = createVeloxHooks<AppRouter>();
 *
 * // Both support:
 * // api.users.getUser.useQuery({ id })
 * // api.users.createUser.useMutation()
 * ```
 */
export type VeloxHooks<TRouter> = {
  [K in keyof TRouter]: TRouter[K] extends ProcedureCollection<infer _TNamespace, infer TProcedures>
    ? VeloxNamespace<TProcedures>
    : TRouter[K] extends Record<string, { _def: unknown }>
      ? VeloxTRPCNamespace<TRouter[K]>
      : never;
};

// ============================================================================
// Factory Configuration
// ============================================================================

/**
 * Configuration for createVeloxHooks
 */
export interface VeloxHooksConfig<TRouter = unknown> {
  /**
   * Optional: provide client directly instead of using context
   *
   * This is useful for:
   * - Server-side rendering (SSR) where context isn't available
   * - Testing scenarios
   * - Using hooks outside VeloxProvider
   *
   * @example
   * ```typescript
   * // For SSR
   * const client = createClient<AppRouter>({ baseUrl: '/api' });
   * const api = createVeloxHooks<AppRouter>({ client });
   * ```
   */
  client?: ClientFromRouter<TRouter>;

  /**
   * Optional: route metadata from backend
   *
   * When provided, the `kind` field in route entries overrides the naming
   * convention heuristic for determining query vs mutation. This is useful
   * for procedures that don't follow naming conventions.
   *
   * Generate this using `extractRoutes()` from `@veloxts/router`:
   *
   * @example
   * ```typescript
   * // Backend: api/index.ts
   * import { extractRoutes } from '@veloxts/router';
   * export const routes = extractRoutes([userProcedures, authProcedures]);
   *
   * // Frontend: api.ts
   * import { createVeloxHooks } from '@veloxts/client/react';
   * import { routes } from '../../api/src/index.js';
   *
   * export const api = createVeloxHooks<AppRouter>({ routes });
   *
   * // Now non-conventional procedures work correctly:
   * api.health.check.useQuery({});  // Works even though 'check' is not a query prefix
   * ```
   */
  routes?: RouteMap;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Generic client type for internal use
 * @internal
 */
export type GenericClient = Record<string, Record<string, (input: unknown) => Promise<unknown>>>;

/**
 * Function to get client instance
 * Can either use context (returns undefined if not in component) or direct client
 * @internal
 */
export type ClientGetter<TRouter> = () => ClientFromRouter<TRouter>;
