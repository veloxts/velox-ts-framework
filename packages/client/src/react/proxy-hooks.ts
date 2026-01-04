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

import type { QueryClient } from '@tanstack/react-query';
import {
  useMutation as useReactMutation,
  useQuery as useReactQuery,
  useQueryClient as useReactQueryClient,
  useSuspenseQuery as useReactSuspenseQuery,
} from '@tanstack/react-query';

import type { RouteEntry, RouteMap } from '../types.js';
import { useVeloxContext } from './provider.js';
import type {
  AutoInvalidationConfig,
  ClientGetter,
  GenericClient,
  InvalidationContext,
  VeloxHooks,
  VeloxHooksConfig,
  VeloxMutationOptions,
  VeloxMutationProcedure,
  VeloxQueryProcedure,
} from './proxy-types.js';
import { buildQueryKey } from './utils.js';

// ============================================================================
// Query/Mutation Detection
// ============================================================================

/**
 * Query procedure naming prefixes
 * Procedures starting with these prefixes are treated as queries.
 */
const QUERY_PREFIXES = ['get', 'list', 'find'] as const;

/**
 * Mutation procedure naming prefixes
 * Procedures starting with these prefixes are treated as mutations.
 */
const MUTATION_PREFIXES = ['create', 'add', 'update', 'edit', 'patch', 'delete', 'remove'] as const;

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
  return QUERY_PREFIXES.some((prefix) => procedureName.startsWith(prefix));
}

/**
 * Creates a helpful error message for naming convention violations
 *
 * @param procedureName - The procedure name that was accessed incorrectly
 * @param attemptedMethod - The method that was called (e.g., 'useQuery', 'useMutation')
 * @param isQuery - Whether the procedure is detected as a query
 */
function createNamingConventionError(
  procedureName: string,
  attemptedMethod: string,
  isQuery: boolean
): Error {
  const queryMethods = 'useQuery, useSuspenseQuery, getQueryKey, invalidate, prefetch, setData, getData';
  const mutationMethods = 'useMutation';

  if (isQuery) {
    // Called mutation method on a query procedure
    const suggestions = MUTATION_PREFIXES.map((p) => `${p}${procedureName.charAt(0).toUpperCase()}${procedureName.slice(1)}`);
    return new Error(
      `Cannot call ${attemptedMethod}() on query procedure "${procedureName}".\n\n` +
        `VeloxTS Naming Convention:\n` +
        `  • Query procedures must start with: ${QUERY_PREFIXES.join(', ')}\n` +
        `  • Mutation procedures must start with: ${MUTATION_PREFIXES.join(', ')}\n\n` +
        `"${procedureName}" starts with a query prefix, so only these methods are available:\n` +
        `  ${queryMethods}\n\n` +
        `If this should be a mutation, rename it to one of:\n` +
        `  ${suggestions.slice(0, 3).join(', ')}`
    );
  }

  // Called query method on a mutation procedure
  const suggestions = QUERY_PREFIXES.map((p) => `${p}${procedureName.charAt(0).toUpperCase()}${procedureName.slice(1)}`);
  return new Error(
    `Cannot call ${attemptedMethod}() on mutation procedure "${procedureName}".\n\n` +
      `VeloxTS Naming Convention:\n` +
      `  • Query procedures must start with: ${QUERY_PREFIXES.join(', ')}\n` +
      `  • Mutation procedures must start with: ${MUTATION_PREFIXES.join(', ')}\n\n` +
      `"${procedureName}" does not start with a query prefix, so only these methods are available:\n` +
      `  ${mutationMethods}\n\n` +
      `If this should be a query, rename it to one of:\n` +
      `  ${suggestions.join(', ')}`
  );
}

// ============================================================================
// Auto-Invalidation Logic
// ============================================================================

/**
 * Mutation type for determining invalidation rules
 * @internal
 */
type MutationType = 'create' | 'update' | 'delete' | 'unknown';

/**
 * Determines the mutation type from procedure name
 * @internal
 */
function getMutationType(procedureName: string): MutationType {
  if (/^(?:create|add)/.test(procedureName)) return 'create';
  if (/^(?:update|edit|patch)/.test(procedureName)) return 'update';
  if (/^(?:delete|remove)/.test(procedureName)) return 'delete';
  return 'unknown';
}

/**
 * Extracts ID from mutation input for targeted invalidation
 *
 * Looks for common patterns:
 * - `{ id }` - Direct id field
 * - `{ userId }`, `{ postId }` - *Id pattern
 * - `{ data: { id } }` - Nested in data object
 *
 * @internal
 */
function extractIdFromInput(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;

  const obj = input as Record<string, unknown>;

  // Direct id field
  if (typeof obj.id === 'string') return obj.id;
  if (typeof obj.id === 'number') return String(obj.id);

  // *Id pattern (userId, postId, etc.)
  for (const key of Object.keys(obj)) {
    if (key.endsWith('Id') && (typeof obj[key] === 'string' || typeof obj[key] === 'number')) {
      return String(obj[key]);
    }
  }

  // Nested in data
  if (obj.data && typeof obj.data === 'object') {
    const data = obj.data as Record<string, unknown>;
    if (typeof data.id === 'string') return data.id;
    if (typeof data.id === 'number') return String(data.id);
  }

  return null;
}

/**
 * Performs convention-based cache invalidation after mutation success
 *
 * Invalidation rules:
 * - `create*`, `add*` → invalidates `list*`, `find*` queries
 * - `update*`, `edit*`, `patch*` → invalidates `get*` (matching ID), `list*`, `find*`
 * - `delete*`, `remove*` → invalidates `get*` (matching ID), `list*`, `find*`
 *
 * @internal
 */
async function performAutoInvalidation(
  queryClient: QueryClient,
  namespace: string,
  procedureName: string,
  input: unknown,
  output: unknown,
  config?: AutoInvalidationConfig
): Promise<void> {
  const mutationType = getMutationType(procedureName);
  const exclude = config?.exclude ?? [];

  // Get all queries in this namespace from the cache
  const queries = queryClient.getQueryCache().findAll({ queryKey: [namespace] });

  for (const query of queries) {
    const queryKey = query.queryKey as [string, string, unknown?];
    const queryProcName = queryKey[1];

    // Skip if excluded
    if (exclude.includes(queryProcName)) continue;

    // Create/Update/Delete all invalidate list/find queries
    if (/^(?:list|find)/.test(queryProcName)) {
      await queryClient.invalidateQueries({ queryKey: [namespace, queryProcName] });
      continue;
    }

    // Update/Delete also invalidate matching get queries
    if (mutationType !== 'create' && /^get/.test(queryProcName)) {
      const id = extractIdFromInput(input) ?? extractIdFromInput(output);
      if (id) {
        // Invalidate the specific query if it matches the ID
        const queryInput = queryKey[2] as Record<string, unknown> | undefined;
        const queryId = queryInput ? extractIdFromInput(queryInput) : null;
        if (queryId === id) {
          await queryClient.invalidateQueries({ queryKey: query.queryKey });
        }
      }
    }
  }

  // Handle additional invalidations from config
  if (config?.additional) {
    for (const [ns, proc, inp] of config.additional) {
      const queryKey = inp !== undefined ? [ns, proc, inp] : [ns, proc];
      await queryClient.invalidateQueries({ queryKey });
    }
  }

  // Run custom invalidation handler if provided
  if (config?.custom) {
    const context: InvalidationContext = {
      namespace,
      procedureName,
      input,
      data: output,
      queryClient,
      invalidate: async (proc, inp) => {
        const queryKey = inp !== undefined ? [namespace, proc, inp] : [namespace, proc];
        await queryClient.invalidateQueries({ queryKey });
      },
    };
    await config.custom(context);
  }
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
  // Add useMutation stub that throws helpful error
  const proxy = {
    useQuery(...args: Parameters<VeloxQueryProcedure<TInput, TOutput>['useQuery']>) {
      const [input, options] = args;
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

    useSuspenseQuery(...args: Parameters<VeloxQueryProcedure<TInput, TOutput>['useSuspenseQuery']>) {
      const [input, options] = args;
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

    getQueryKey(input: TInput) {
      return buildQueryKey(namespace, procedureName, input);
    },

    invalidate(input: TInput | undefined, queryClient: QueryClient) {
      const queryKey = input
        ? buildQueryKey(namespace, procedureName, input)
        : [namespace, procedureName];
      return queryClient.invalidateQueries({ queryKey });
    },

    prefetch(...args: Parameters<VeloxQueryProcedure<TInput, TOutput>['prefetch']>) {
      const [input, queryClient] = args;
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

    setData(input: TInput, data: TOutput, queryClient: QueryClient) {
      const queryKey = buildQueryKey(namespace, procedureName, input);
      queryClient.setQueryData(queryKey, data);
    },

    getData(input: TInput, queryClient: QueryClient) {
      const queryKey = buildQueryKey(namespace, procedureName, input);
      return queryClient.getQueryData(queryKey) as TOutput | undefined;
    },

    // Stub that throws helpful error when called on a query procedure
    useMutation() {
      throw createNamingConventionError(procedureName, 'useMutation', true);
    },
  };

  return proxy as VeloxQueryProcedure<TInput, TOutput>;
}

/**
 * Creates a mutation procedure proxy with hook methods and auto-invalidation
 *
 * Auto-invalidation is enabled by default and follows naming conventions:
 * - `create*`, `add*` → invalidates `list*`, `find*` queries
 * - `update*`, `edit*`, `patch*` → invalidates `get*` (matching ID), `list*`, `find*`
 * - `delete*`, `remove*` → invalidates `get*` (matching ID), `list*`, `find*`
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
  // Add query method stubs that throw helpful errors
  const proxy = {
    useMutation(options?: VeloxMutationOptions<TOutput, TInput>) {
      const client = getClient() as GenericClient;
      const queryClient = useReactQueryClient();

      // Extract auto-invalidation configuration
      const autoInvalidateOption = options?.autoInvalidate;
      const autoInvalidateEnabled = autoInvalidateOption !== false;
      const autoInvalidateConfig =
        typeof autoInvalidateOption === 'object' ? autoInvalidateOption : undefined;

      // Store original onSuccess to call after auto-invalidation
      const originalOnSuccess = options?.onSuccess;

      return useReactMutation({
        mutationFn: async (input: TInput) => {
          const namespaceClient = client[namespace];
          const procedure = namespaceClient[procedureName];
          return procedure(input) as Promise<TOutput>;
        },
        ...options,
        onSuccess: async (data, variables, context, meta) => {
          // Perform auto-invalidation if enabled
          if (autoInvalidateEnabled) {
            await performAutoInvalidation(
              queryClient,
              namespace,
              procedureName,
              variables,
              data,
              autoInvalidateConfig
            );
          }

          // Call user's onSuccess callback if provided (React Query v5 signature)
          if (originalOnSuccess) {
            await originalOnSuccess(data, variables, context, meta);
          }
        },
      });
    },

    // Stubs that throw helpful errors when called on a mutation procedure
    useQuery() {
      throw createNamingConventionError(procedureName, 'useQuery', false);
    },
    useSuspenseQuery() {
      throw createNamingConventionError(procedureName, 'useSuspenseQuery', false);
    },
    getQueryKey() {
      throw createNamingConventionError(procedureName, 'getQueryKey', false);
    },
    invalidate() {
      throw createNamingConventionError(procedureName, 'invalidate', false);
    },
    prefetch() {
      throw createNamingConventionError(procedureName, 'prefetch', false);
    },
    setData() {
      throw createNamingConventionError(procedureName, 'setData', false);
    },
    getData() {
      throw createNamingConventionError(procedureName, 'getData', false);
    },
  };

  return proxy as VeloxMutationProcedure<TInput, TOutput>;
}

// ============================================================================
// Namespace Proxy
// ============================================================================

/**
 * Determines procedure type using routes metadata or naming convention
 *
 * Priority:
 * 1. If routes has explicit `kind` for this procedure, use it
 * 2. Otherwise, fall back to naming convention heuristic
 *
 * @param namespace - The procedure namespace
 * @param procedureName - The procedure name
 * @param routes - Optional route metadata from backend
 * @returns true if the procedure is a query, false for mutation
 */
function isProcedureQuery(
  namespace: string,
  procedureName: string,
  routes?: RouteMap
): boolean {
  // Check routes for explicit kind first
  const routeEntry = routes?.[namespace]?.[procedureName];
  if (routeEntry) {
    // RouteEntry can be object with kind, or legacy string (path only)
    if (typeof routeEntry === 'object' && 'kind' in routeEntry) {
      return (routeEntry as RouteEntry).kind === 'query';
    }
  }

  // Fall back to naming convention
  return isQueryProcedure(procedureName);
}

/**
 * Creates a proxy for a namespace that returns procedure proxies
 *
 * Each property access on the namespace proxy creates a procedure proxy
 * with the appropriate methods (useQuery for queries, useMutation for mutations).
 *
 * @param namespace - The namespace name (e.g., 'users')
 * @param getClient - Factory function to get the client
 * @param routes - Optional route metadata for explicit kind detection
 */
function createNamespaceProxy<TRouter>(
  namespace: string,
  getClient: ClientGetter<TRouter>,
  routes?: RouteMap
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

        // Create new procedure proxy based on routes metadata or naming convention
        const procedureProxy = isProcedureQuery(namespace, procedureName, routes)
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

  // Extract routes for explicit kind detection
  const routes = config?.routes;

  // Create the root proxy
  return new Proxy({} as VeloxHooks<TRouter>, {
    get(_target, namespace: string) {
      // Return cached namespace proxy if available
      const cached = namespaceCache.get(namespace);
      if (cached) {
        return cached;
      }

      // Create new namespace proxy with routes for kind detection
      const namespaceProxy = createNamespaceProxy<TRouter>(namespace, getClient, routes);

      // Cache for future access
      namespaceCache.set(namespace, namespaceProxy);

      return namespaceProxy;
    },
  });
}
