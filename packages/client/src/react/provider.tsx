/**
 * VeloxProvider - React context provider for VeloxTS client
 *
 * Wraps your React application to provide access to the VeloxTS client
 * and React Query's QueryClient.
 *
 * @module @veloxts/client/react/provider
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { createClient } from '../client.js';
import type { VeloxContextValue, VeloxProviderProps } from './types.js';

// ============================================================================
// Context
// ============================================================================

/**
 * Internal context for VeloxTS client
 *
 * Typed as `unknown` at creation time since the router type
 * is provided by the consumer via generic parameter.
 */
const VeloxContext = createContext<VeloxContextValue<unknown> | null>(null);

// ============================================================================
// Default QueryClient
// ============================================================================

/**
 * Creates a default QueryClient with sensible defaults for VeloxTS
 */
function createDefaultQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30 seconds
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * Provider component that sets up VeloxTS client and React Query
 *
 * This provider:
 * - Creates a memoized VeloxTS client instance from the provided config
 * - Sets up React Query's QueryClientProvider
 * - Makes the client available to hooks via React context
 *
 * @template TRouter - The router type defining your procedure collections
 *
 * @example Basic usage
 * ```tsx
 * import { VeloxProvider } from '@veloxts/client/react';
 * import type { userProcedures, postProcedures } from './server/procedures';
 *
 * type AppRouter = {
 *   users: typeof userProcedures;
 *   posts: typeof postProcedures;
 * };
 *
 * function App() {
 *   return (
 *     <VeloxProvider<AppRouter> config={{ baseUrl: '/api' }}>
 *       <YourApp />
 *     </VeloxProvider>
 *   );
 * }
 * ```
 *
 * @example With custom QueryClient
 * ```tsx
 * import { QueryClient } from '@tanstack/react-query';
 *
 * const queryClient = new QueryClient({
 *   defaultOptions: {
 *     queries: { staleTime: 60_000 },
 *   },
 * });
 *
 * function App() {
 *   return (
 *     <VeloxProvider<AppRouter>
 *       config={{ baseUrl: '/api' }}
 *       queryClient={queryClient}
 *     >
 *       <YourApp />
 *     </VeloxProvider>
 *   );
 * }
 * ```
 *
 * @example With custom headers
 * ```tsx
 * function App() {
 *   const token = useAuthToken();
 *
 *   const config = useMemo(() => ({
 *     baseUrl: '/api',
 *     headers: {
 *       Authorization: `Bearer ${token}`,
 *     },
 *   }), [token]);
 *
 *   return (
 *     <VeloxProvider<AppRouter> config={config}>
 *       <YourApp />
 *     </VeloxProvider>
 *   );
 * }
 * ```
 */
export function VeloxProvider<TRouter>({
  children,
  config,
  queryClient: providedQueryClient,
}: VeloxProviderProps<TRouter>): ReactNode {
  // Create client instance, memoized based on config reference
  // Users should memoize their config object if they need to prevent re-renders
  const client = useMemo(() => createClient<TRouter>(config), [config]);

  // Use provided QueryClient or create default
  // Only create once to avoid query state loss
  const queryClient = useMemo(
    () => providedQueryClient ?? createDefaultQueryClient(),
    [providedQueryClient]
  );

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<VeloxContextValue<TRouter>>(() => ({ client }), [client]);

  return (
    <VeloxContext.Provider value={contextValue as VeloxContextValue<unknown>}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </VeloxContext.Provider>
  );
}

// ============================================================================
// Context Hook
// ============================================================================

/**
 * Hook to access VeloxTS client from context
 *
 * This is primarily used internally by useQuery and useMutation hooks,
 * but can also be used directly for advanced use cases.
 *
 * @template TRouter - The router type for type-safe client access
 * @returns The context value containing the typed client
 * @throws Error if used outside of VeloxProvider
 *
 * @example Direct client access (advanced)
 * ```tsx
 * function MyComponent() {
 *   const { client } = useVeloxContext<AppRouter>();
 *
 *   // Direct client access for edge cases
 *   const handleClick = async () => {
 *     const user = await client.users.getUser({ id: '123' });
 *     console.log(user);
 *   };
 * }
 * ```
 */
export function useVeloxContext<TRouter>(): VeloxContextValue<TRouter> {
  const context = useContext(VeloxContext);

  if (!context) {
    throw new Error(
      'useVeloxContext must be used within a VeloxProvider. ' +
        'Wrap your component tree with <VeloxProvider config={{...}}>.'
    );
  }

  return context as VeloxContextValue<TRouter>;
}

// ============================================================================
// Re-export types
// ============================================================================

export type { VeloxProviderProps, VeloxContextValue };
