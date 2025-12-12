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
  ProcedureType,
} from '../types.js';
import type { VeloxQueryKey } from './types.js';

// ============================================================================
// Procedure Type Detection
// ============================================================================

/**
 * Extracts the procedure type ('query' or 'mutation') from a ClientProcedure
 *
 * @internal
 */
type ExtractProcedureType<T> =
  T extends ClientProcedure<unknown, unknown>
    ? T extends { readonly type: infer TType }
      ? TType extends ProcedureType
        ? TType
        : 'query'
      : 'query'
    : never;

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
   * @param input - Procedure input (fully typed)
   * @param options - React Query options (queryKey and queryFn auto-provided)
   * @returns UseQueryResult with typed data
   *
   * @example
   * ```tsx
   * const { data, isLoading, error } = api.users.getUser.useQuery(
   *   { id: userId },
   *   { staleTime: 60_000 }
   * );
   * ```
   */
  useQuery(
    input: TInput,
    options?: Omit<UseQueryOptions<TOutput, Error>, 'queryKey' | 'queryFn'>
  ): UseQueryResult<TOutput, Error>;

  /**
   * Suspense-enabled query hook
   *
   * Throws a promise for Suspense boundaries to catch.
   * Data is guaranteed to be available when component renders.
   *
   * @example
   * ```tsx
   * function UserProfile({ userId }: { userId: string }) {
   *   // Component only renders when data is available
   *   const { data: user } = api.users.getUser.useSuspenseQuery({ id: userId });
   *   return <h1>{user.name}</h1>;
   * }
   *
   * // Usage with Suspense boundary
   * <Suspense fallback={<Spinner />}>
   *   <UserProfile userId="123" />
   * </Suspense>
   * ```
   */
  useSuspenseQuery(
    input: TInput,
    options?: Omit<UseSuspenseQueryOptions<TOutput, Error>, 'queryKey' | 'queryFn'>
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
   * @param input - Procedure input (unique data first)
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
  prefetch(input: TInput, queryClient: QueryClient): Promise<void>;

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
    options?: Omit<UseMutationOptions<TOutput, Error, TInput, TContext>, 'mutationFn'>
  ): UseMutationResult<TOutput, Error, TInput, TContext>;
}

// ============================================================================
// Procedure Type Resolution
// ============================================================================

/**
 * Resolves a procedure to its appropriate hook interface
 * based on whether it's a query or mutation
 *
 * @internal
 */
type VeloxProcedureHooks<TProcedure> =
  TProcedure extends ClientProcedure<infer TInput, infer TOutput>
    ? ExtractProcedureType<TProcedure> extends 'query'
      ? VeloxQueryProcedure<TInput, TOutput>
      : ExtractProcedureType<TProcedure> extends 'mutation'
        ? VeloxMutationProcedure<TInput, TOutput>
        : never
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

/**
 * Maps router namespaces to their namespace hook interfaces
 *
 * This is the top-level type returned by `createVeloxHooks`.
 *
 * @template TRouter - The router type (collection of procedure collections)
 *
 * @example
 * ```typescript
 * type AppRouter = {
 *   users: typeof userProcedures;
 *   posts: typeof postProcedures;
 * };
 *
 * const api: VeloxHooks<AppRouter> = createVeloxHooks<AppRouter>();
 * // api.users.getUser is VeloxQueryProcedure<{id: string}, User>
 * // api.users.createUser is VeloxMutationProcedure<CreateUserInput, User>
 * ```
 */
export type VeloxHooks<TRouter> = {
  [K in keyof TRouter]: TRouter[K] extends ProcedureCollection<infer TProcedures>
    ? VeloxNamespace<TProcedures>
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
