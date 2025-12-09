/**
 * React hooks for VeloxTS API calls
 *
 * Provides type-safe hooks for queries and mutations
 * with full integration with React Query.
 *
 * @module @veloxts/client/react/hooks
 */

import {
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
  useMutation as useReactMutation,
  useQuery as useReactQuery,
  useQueryClient as useReactQueryClient,
} from '@tanstack/react-query';

import type { InferProcedureInput, InferProcedureOutput } from '../types.js';
import { useVeloxContext } from './provider.js';
import type {
  GetProcedure,
  GetProceduresFromCollection,
  VeloxUseMutationOptions,
  VeloxUseQueryOptions,
} from './types.js';
import { buildQueryKey } from './utils.js';

// ============================================================================
// useQuery Hook
// ============================================================================

/**
 * Type-safe query hook for VeloxTS procedures
 *
 * Wraps React Query's useQuery with automatic type inference from
 * your backend procedure definitions. The hook automatically:
 * - Builds a stable query key from namespace, procedure, and input
 * - Provides full type safety for input and output
 * - Integrates with React Query's caching and refetching
 *
 * @template TRouter - The router type (typeof imported procedures)
 * @template TNamespace - The namespace key (e.g., 'users', 'posts')
 * @template TProcedureName - The procedure name (e.g., 'getUser', 'listUsers')
 *
 * @param namespace - Resource namespace (e.g., 'users')
 * @param procedureName - Procedure name (e.g., 'getUser')
 * @param input - Input matching the procedure's input schema
 * @param options - React Query options (optional)
 *
 * @returns UseQueryResult with typed data and error
 *
 * @example Basic usage
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const { data: user, isLoading, error } = useQuery(
 *     'users',
 *     'getUser',
 *     { id: userId }
 *   );
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!user) return <div>User not found</div>;
 *
 *   return <div>{user.name}</div>;
 * }
 * ```
 *
 * @example With options
 * ```tsx
 * const { data } = useQuery(
 *   'users',
 *   'listUsers',
 *   { page: 1, limit: 10 },
 *   {
 *     staleTime: 60_000,
 *     refetchOnWindowFocus: true,
 *   }
 * );
 * ```
 *
 * @example Conditional query
 * ```tsx
 * const { data } = useQuery(
 *   'users',
 *   'getUser',
 *   { id: userId },
 *   { enabled: !!userId }
 * );
 * ```
 */
export function useQuery<
  TRouter,
  TNamespace extends keyof TRouter,
  TProcedureName extends keyof GetProceduresFromCollection<TRouter[TNamespace]>,
>(
  namespace: TNamespace,
  procedureName: TProcedureName,
  input: InferProcedureInput<GetProcedure<TRouter, TNamespace, TProcedureName>>,
  options?: VeloxUseQueryOptions<
    InferProcedureOutput<GetProcedure<TRouter, TNamespace, TProcedureName>>
  >
): UseQueryResult<InferProcedureOutput<GetProcedure<TRouter, TNamespace, TProcedureName>>, Error> {
  const { client } = useVeloxContext<TRouter>();

  // Type alias for cleaner code
  type TOutput = InferProcedureOutput<GetProcedure<TRouter, TNamespace, TProcedureName>>;

  // Build stable query key
  const queryKey = buildQueryKey(namespace as string, procedureName as string, input);

  return useReactQuery<TOutput, Error>({
    queryKey,
    queryFn: async () => {
      // Access the namespace client
      // Use unknown intermediate cast for type safety with generic constraints
      const namespaceClient = client[namespace] as unknown as Record<
        string,
        (input: unknown) => Promise<TOutput>
      >;

      // Get the procedure function
      const procedure = namespaceClient[procedureName as string];

      // Call the procedure with input
      return procedure(input);
    },
    ...options,
  });
}

// ============================================================================
// useMutation Hook
// ============================================================================

/**
 * Type-safe mutation hook for VeloxTS procedures
 *
 * Wraps React Query's useMutation with automatic type inference from
 * your backend procedure definitions. The hook provides:
 * - Full type safety for input and output
 * - Access to mutation lifecycle callbacks (onSuccess, onError, etc.)
 * - Optimistic update support via context
 *
 * @template TRouter - The router type
 * @template TNamespace - The namespace key
 * @template TProcedureName - The procedure name (should be a mutation)
 *
 * @param namespace - Resource namespace (e.g., 'users')
 * @param procedureName - Procedure name (e.g., 'createUser')
 * @param options - React Query mutation options (optional)
 *
 * @returns UseMutationResult with typed variables, data, and error
 *
 * @example Basic usage
 * ```tsx
 * function CreateUserForm() {
 *   const { mutate: createUser, isPending, error } = useMutation(
 *     'users',
 *     'createUser'
 *   );
 *
 *   const handleSubmit = (e: FormEvent) => {
 *     e.preventDefault();
 *     createUser({ name: 'Alice', email: 'alice@example.com' });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <button type="submit" disabled={isPending}>
 *         {isPending ? 'Creating...' : 'Create User'}
 *       </button>
 *       {error && <div>{error.message}</div>}
 *     </form>
 *   );
 * }
 * ```
 *
 * @example With cache invalidation
 * ```tsx
 * const queryClient = useQueryClient();
 *
 * const { mutate } = useMutation('users', 'createUser', {
 *   onSuccess: () => {
 *     queryClient.invalidateQueries({ queryKey: ['users', 'listUsers'] });
 *   },
 * });
 * ```
 *
 * @example With optimistic update
 * ```tsx
 * const { mutate } = useMutation('users', 'updateUser', {
 *   onMutate: async (newUser) => {
 *     await queryClient.cancelQueries({ queryKey: ['users', 'getUser', { id: newUser.id }] });
 *     const previousUser = queryClient.getQueryData(['users', 'getUser', { id: newUser.id }]);
 *     queryClient.setQueryData(['users', 'getUser', { id: newUser.id }], newUser);
 *     return { previousUser };
 *   },
 *   onError: (err, newUser, context) => {
 *     if (context?.previousUser) {
 *       queryClient.setQueryData(['users', 'getUser', { id: newUser.id }], context.previousUser);
 *     }
 *   },
 * });
 * ```
 */
export function useMutation<
  TRouter,
  TNamespace extends keyof TRouter,
  TProcedureName extends keyof GetProceduresFromCollection<TRouter[TNamespace]>,
  TContext = unknown,
>(
  namespace: TNamespace,
  procedureName: TProcedureName,
  options?: VeloxUseMutationOptions<
    InferProcedureOutput<GetProcedure<TRouter, TNamespace, TProcedureName>>,
    InferProcedureInput<GetProcedure<TRouter, TNamespace, TProcedureName>>,
    Error,
    TContext
  >
): UseMutationResult<
  InferProcedureOutput<GetProcedure<TRouter, TNamespace, TProcedureName>>,
  Error,
  InferProcedureInput<GetProcedure<TRouter, TNamespace, TProcedureName>>,
  TContext
> {
  const { client } = useVeloxContext<TRouter>();

  // Type aliases for cleaner code
  type TInput = InferProcedureInput<GetProcedure<TRouter, TNamespace, TProcedureName>>;
  type TOutput = InferProcedureOutput<GetProcedure<TRouter, TNamespace, TProcedureName>>;

  return useReactMutation<TOutput, Error, TInput, TContext>({
    mutationFn: async (input: TInput) => {
      // Access the namespace client
      // Use unknown intermediate cast for type safety with generic constraints
      const namespaceClient = client[namespace] as unknown as Record<
        string,
        (input: unknown) => Promise<TOutput>
      >;

      // Get the procedure function
      const procedure = namespaceClient[procedureName as string];

      // Call the procedure with input
      return procedure(input);
    },
    ...options,
  });
}

// ============================================================================
// useQueryClient Hook
// ============================================================================

/**
 * Hook to access React Query's QueryClient for manual cache operations
 *
 * This is a direct re-export of React Query's useQueryClient for convenience.
 * Use this for manual cache invalidation, prefetching, or optimistic updates.
 *
 * @returns The QueryClient instance
 *
 * @example Cache invalidation
 * ```tsx
 * function MyComponent() {
 *   const queryClient = useQueryClient();
 *   const { mutate } = useMutation('users', 'createUser', {
 *     onSuccess: () => {
 *       // Invalidate and refetch users list
 *       queryClient.invalidateQueries({ queryKey: ['users', 'listUsers'] });
 *     },
 *   });
 * }
 * ```
 *
 * @example Prefetching
 * ```tsx
 * function UserListItem({ userId }: { userId: string }) {
 *   const queryClient = useQueryClient();
 *
 *   const handleMouseEnter = () => {
 *     // Prefetch user data on hover
 *     queryClient.prefetchQuery({
 *       queryKey: ['users', 'getUser', { id: userId }],
 *       queryFn: () => api.users.getUser({ id: userId }),
 *     });
 *   };
 * }
 * ```
 */
export function useQueryClient(): QueryClient {
  return useReactQueryClient();
}
