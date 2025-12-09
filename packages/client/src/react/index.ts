/**
 * @veloxts/client/react - React hooks for VeloxTS
 *
 * Type-safe React Query integration for VeloxTS procedures.
 * Provides hooks that automatically infer types from your backend
 * procedure definitions without any code generation.
 *
 * @example Quick Start
 * ```tsx
 * // 1. Define your router type (imports backend procedure types)
 * import type { userProcedures, postProcedures } from '../server/procedures';
 *
 * type AppRouter = {
 *   users: typeof userProcedures;
 *   posts: typeof postProcedures;
 * };
 *
 * // 2. Wrap your app with VeloxProvider
 * import { VeloxProvider } from '@veloxts/client/react';
 *
 * function App() {
 *   return (
 *     <VeloxProvider<AppRouter> config={{ baseUrl: '/api' }}>
 *       <UserList />
 *     </VeloxProvider>
 *   );
 * }
 *
 * // 3. Use hooks in components
 * import { useQuery, useMutation, useQueryClient } from '@veloxts/client/react';
 *
 * function UserList() {
 *   // Query - data is fully typed!
 *   const { data, isLoading } = useQuery('users', 'listUsers', {});
 *
 *   // Mutation with cache invalidation
 *   const queryClient = useQueryClient();
 *   const { mutate: createUser } = useMutation('users', 'createUser', {
 *     onSuccess: () => {
 *       queryClient.invalidateQueries({ queryKey: ['users'] });
 *     },
 *   });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {data?.data.map(user => (
 *         <li key={user.id}>{user.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 *
 * @module @veloxts/client/react
 */

// ============================================================================
// Provider
// ============================================================================

export type { VeloxContextValue, VeloxProviderProps } from './provider.js';
export { useVeloxContext, VeloxProvider } from './provider.js';

// ============================================================================
// Hooks
// ============================================================================

export { useMutation, useQuery, useQueryClient } from './hooks.js';

// ============================================================================
// Utilities
// ============================================================================

export {
  buildQueryKey,
  getQueryData,
  invalidateNamespace,
  invalidateProcedure,
  invalidateQuery,
  setQueryData,
} from './utils.js';

// ============================================================================
// Types
// ============================================================================

export type {
  ClientConfig,
  ClientFromRouter,
  GetProcedure,
  GetProceduresFromCollection,
  InferProcedureInput,
  InferProcedureOutput,
  ProcedureCollection,
  VeloxQueryKey,
  VeloxUseMutationOptions,
  VeloxUseQueryOptions,
} from './types.js';
