/**
 * Proxy-based React hooks for VeloxTS
 *
 * Provides tRPC-style ergonomics with full IDE autocomplete
 * by using TypeScript mapped types and JavaScript Proxy objects.
 *
 * @example
 * ```tsx
 * // Create hooks once at app level
 * import { createVeloxHooks } from '@veloxts/client/react';
 * import type { AppRouter } from './api-types';
 *
 * export const api = createVeloxHooks<AppRouter>();
 *
 * // Use in components with full autocomplete
 * function UserProfile({ userId }: { userId: string }) {
 *   const queryClient = useQueryClient();
 *
 *   const { data } = api.users.getUser.useQuery({ id: userId });
 *   const { mutate } = api.users.updateUser.useMutation({
 *     onSuccess: () => api.users.getUser.invalidate({ id: userId }, queryClient),
 *   });
 * }
 * ```
 *
 * @module @veloxts/client/react/proxy-hooks
 */

import {
  useMutation as useReactMutation,
  useQuery as useReactQuery,
  useSuspenseQuery as useReactSuspenseQuery,
} from '@tanstack/react-query';

import { useVeloxContext } from './provider.js';
import type {
  ClientGetter,
  GenericClient,
  VeloxHooks,
  VeloxHooksConfig,
  VeloxMutationProcedure,
  VeloxQueryProcedure,
} from './proxy-types.js';
import { buildQueryKey } from './utils.js';

// ============================================================================
// Query/Mutation Detection
// ============================================================================

/**
 * Determines if a procedure is a query based on naming convention
 *
 * Matches the logic in @veloxts/router for consistency.
 * Procedures starting with these prefixes are queries:
 * - get* (e.g., getUser, getProfile)
 * - list* (e.g., listUsers, listPosts)
 * - find* (e.g., findUsers, findByEmail)
 *
 * Everything else is considered a mutation.
 *
 * @param procedureName - The procedure name to check
 * @returns true if the procedure is a query, false for mutation
 */
function isQueryProcedure(procedureName: string): boolean {
  const queryPrefixes = ['get', 'list', 'find'];
  return queryPrefixes.some((prefix) => procedureName.startsWith(prefix));
}

// ============================================================================
// Procedure Proxy Creators
// ============================================================================

/**
 * Creates a query procedure proxy with all hook methods
 *
 * @param namespace - The procedure namespace (e.g., 'users')
 * @param procedureName - The procedure name (e.g., 'getUser')
 * @param getClient - Factory function to get the client (called inside hooks)
 */
function createQueryProcedureProxy<TInput, TOutput>(
  namespace: string,
  procedureName: string,
  getClient: ClientGetter<unknown>
): VeloxQueryProcedure<TInput, TOutput> {
  return {
    useQuery(input, options) {
      const client = getClient() as GenericClient;
      const queryKey = buildQueryKey(namespace, procedureName, input);

      return useReactQuery({
        queryKey,
        queryFn: async () => {
          const namespaceClient = client[namespace];
          const procedure = namespaceClient[procedureName];
          return procedure(input) as Promise<TOutput>;
        },
        ...options,
      });
    },

    useSuspenseQuery(input, options) {
      const client = getClient() as GenericClient;
      const queryKey = buildQueryKey(namespace, procedureName, input);

      return useReactSuspenseQuery({
        queryKey,
        queryFn: async () => {
          const namespaceClient = client[namespace];
          const procedure = namespaceClient[procedureName];
          return procedure(input) as Promise<TOutput>;
        },
        ...options,
      });
    },

    getQueryKey(input) {
      return buildQueryKey(namespace, procedureName, input);
    },

    invalidate(input, queryClient) {
      const queryKey = input
        ? buildQueryKey(namespace, procedureName, input)
        : [namespace, procedureName];
      return queryClient.invalidateQueries({ queryKey });
    },

    prefetch(input, queryClient) {
      const client = getClient() as GenericClient;
      const queryKey = buildQueryKey(namespace, procedureName, input);

      return queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          const namespaceClient = client[namespace];
          const procedure = namespaceClient[procedureName];
          return procedure(input);
        },
      });
    },

    setData(input, data, queryClient) {
      const queryKey = buildQueryKey(namespace, procedureName, input);
      queryClient.setQueryData(queryKey, data);
    },

    getData(input, queryClient) {
      const queryKey = buildQueryKey(namespace, procedureName, input);
      return queryClient.getQueryData(queryKey) as TOutput | undefined;
    },
  };
}

/**
 * Creates a mutation procedure proxy with hook methods
 *
 * @param namespace - The procedure namespace (e.g., 'users')
 * @param procedureName - The procedure name (e.g., 'createUser')
 * @param getClient - Factory function to get the client (called inside hooks)
 */
function createMutationProcedureProxy<TInput, TOutput>(
  namespace: string,
  procedureName: string,
  getClient: ClientGetter<unknown>
): VeloxMutationProcedure<TInput, TOutput> {
  return {
    useMutation(options) {
      const client = getClient() as GenericClient;

      return useReactMutation({
        mutationFn: async (input: TInput) => {
          const namespaceClient = client[namespace];
          const procedure = namespaceClient[procedureName];
          return procedure(input) as Promise<TOutput>;
        },
        ...options,
      });
    },
  };
}

// ============================================================================
// Namespace Proxy
// ============================================================================

/**
 * Creates a proxy for a namespace that returns procedure proxies
 *
 * Each property access on the namespace proxy creates a procedure proxy
 * with the appropriate methods (useQuery for queries, useMutation for mutations).
 *
 * @param namespace - The namespace name (e.g., 'users')
 * @param getClient - Factory function to get the client
 */
function createNamespaceProxy<TRouter>(
  namespace: string,
  getClient: ClientGetter<TRouter>
): Record<
  string,
  VeloxQueryProcedure<unknown, unknown> | VeloxMutationProcedure<unknown, unknown>
> {
  // Cache procedure proxies to avoid recreating on every access
  const procedureCache = new Map<
    string,
    VeloxQueryProcedure<unknown, unknown> | VeloxMutationProcedure<unknown, unknown>
  >();

  return new Proxy(
    {} as Record<
      string,
      VeloxQueryProcedure<unknown, unknown> | VeloxMutationProcedure<unknown, unknown>
    >,
    {
      get(_target, procedureName: string) {
        // Return cached proxy if available
        const cached = procedureCache.get(procedureName);
        if (cached) {
          return cached;
        }

        // Create new procedure proxy based on naming convention
        const procedureProxy = isQueryProcedure(procedureName)
          ? createQueryProcedureProxy(namespace, procedureName, getClient as ClientGetter<unknown>)
          : createMutationProcedureProxy(
              namespace,
              procedureName,
              getClient as ClientGetter<unknown>
            );

        // Cache for future access
        procedureCache.set(procedureName, procedureProxy);

        return procedureProxy;
      },
    }
  );
}

// ============================================================================
// Main Factory
// ============================================================================

/**
 * Creates a typed proxy for accessing VeloxTS procedures as React hooks
 *
 * This is the primary entry point for the tRPC-style API. It returns a proxy
 * that mirrors your router structure and provides hook methods with full
 * IDE autocomplete.
 *
 * @template TRouter - The router type (collection of procedure collections)
 * @param config - Optional configuration
 * @returns Fully typed proxy with autocomplete for namespaces and procedures
 *
 * @example Basic usage
 * ```tsx
 * // api.ts - Create hooks once
 * import { createVeloxHooks } from '@veloxts/client/react';
 * import type { AppRouter } from '../../api/src';
 *
 * export const api = createVeloxHooks<AppRouter>();
 *
 * // UserProfile.tsx - Use with full autocomplete
 * import { api } from '../api';
 *
 * function UserProfile({ userId }: { userId: string }) {
 *   const { data: user, isLoading } = api.users.getUser.useQuery({ id: userId });
 *
 *   const { mutate: updateUser } = api.users.updateUser.useMutation({
 *     onSuccess: () => {
 *       api.users.getUser.invalidate({ id: userId });
 *     },
 *   });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   return <div>{user?.name}</div>;
 * }
 * ```
 *
 * @example With Suspense
 * ```tsx
 * function UserProfileSuspense({ userId }: { userId: string }) {
 *   // Throws promise for Suspense boundary
 *   const { data: user } = api.users.getUser.useSuspenseQuery({ id: userId });
 *   return <h1>{user.name}</h1>;
 * }
 *
 * // Wrap with Suspense boundary
 * <Suspense fallback={<Spinner />}>
 *   <UserProfileSuspense userId="123" />
 * </Suspense>
 * ```
 *
 * @example SSR with direct client
 * ```tsx
 * import { createClient } from '@veloxts/client';
 *
 * const client = createClient<AppRouter>({ baseUrl: '/api' });
 * const api = createVeloxHooks<AppRouter>({ client });
 * ```
 */
export function createVeloxHooks<TRouter>(config?: VeloxHooksConfig<TRouter>): VeloxHooks<TRouter> {
  // Cache namespace proxies to avoid recreating on every access
  const namespaceCache = new Map<string, ReturnType<typeof createNamespaceProxy>>();

  // Factory function that gets the client
  // If config.client is provided, use it directly (SSR/testing)
  // Otherwise, get from context (must be inside VeloxProvider)
  const getClient: ClientGetter<TRouter> = () => {
    // Must always call hook before returning
    const { client: contextClient } = useVeloxContext<TRouter>();
    return config?.client ?? contextClient;
  };

  // Create the root proxy
  return new Proxy({} as VeloxHooks<TRouter>, {
    get(_target, namespace: string) {
      // Return cached namespace proxy if available
      const cached = namespaceCache.get(namespace);
      if (cached) {
        return cached;
      }

      // Create new namespace proxy
      const namespaceProxy = createNamespaceProxy<TRouter>(namespace, getClient);

      // Cache for future access
      namespaceCache.set(namespace, namespaceProxy);

      return namespaceProxy;
    },
  });
}
