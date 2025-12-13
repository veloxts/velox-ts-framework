/**
 * @veloxts/client/react - React hooks for VeloxTS
 *
 * Type-safe React Query integration for VeloxTS procedures.
 * Provides hooks that automatically infer types from your backend
 * procedure definitions without any code generation.
 *
 * @example Recommended: tRPC-style API (full autocomplete)
 * ```tsx
 * // 1. Create hooks once at app level
 * import { createVeloxHooks } from '@veloxts/client/react';
 * import type { AppRouter } from '../../api/src';
 *
 * export const api = createVeloxHooks<AppRouter>();
 *
 * // 2. Wrap your app with VeloxProvider
 * <VeloxProvider<AppRouter> config={{ baseUrl: '/api' }}>
 *   <App />
 * </VeloxProvider>
 *
 * // 3. Use with full IDE autocomplete
 * function UserProfile({ userId }: { userId: string }) {
 *   const { data: user } = api.users.getUser.useQuery({ id: userId });
 *   const { mutate: updateUser } = api.users.updateUser.useMutation({
 *     onSuccess: () => api.users.getUser.invalidate({ id: userId }),
 *   });
 * }
 * ```
 *
 * @example Legacy API (still supported)
 * ```tsx
 * import { useQuery, useMutation } from '@veloxts/client/react';
 *
 * const { data } = useQuery<AppRouter, 'users', 'listUsers'>('users', 'listUsers', {});
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
// Hooks (Legacy API)
// ============================================================================

export { useMutation, useQuery, useQueryClient } from './hooks.js';

// ============================================================================
// Proxy Hooks (Recommended - tRPC-style API)
// ============================================================================

export { createVeloxHooks } from './proxy-hooks.js';

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

// Proxy hooks types
export type {
  AutoInvalidationConfig,
  InvalidationContext,
  VeloxHooks,
  VeloxHooksConfig,
  VeloxMutationOptions,
  VeloxMutationProcedure,
  VeloxNamespace,
  VeloxQueryProcedure,
} from './proxy-types.js';
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
