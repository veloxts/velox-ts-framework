/**
 * Type definitions for React hooks integration
 *
 * Provides type utilities for building type-safe React Query hooks
 * that work with VeloxTS procedure definitions.
 *
 * @module @veloxts/client/react/types
 */

import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';

import type {
  ClientConfig,
  ClientFromRouter,
  InferProcedureInput,
  InferProcedureOutput,
  ProcedureCollection,
} from '../types.js';

// ============================================================================
// Procedure Type Extraction
// ============================================================================

/**
 * Extracts a specific procedure from the router type
 *
 * Enables type inference for procedure input/output in hooks.
 *
 * @template TRouter - The router type (collection of procedure collections)
 * @template TNamespace - The namespace key (e.g., 'users', 'posts')
 * @template TProcedureName - The procedure name (e.g., 'getUser', 'listUsers')
 */
export type GetProcedure<
  TRouter,
  TNamespace extends keyof TRouter,
  TProcedureName extends keyof GetProceduresFromCollection<TRouter[TNamespace]>,
> = TRouter[TNamespace] extends ProcedureCollection<infer TProcedures>
  ? TProcedureName extends keyof TProcedures
    ? TProcedures[TProcedureName]
    : never
  : never;

/**
 * Extracts the procedures record from a collection
 *
 * @template TCollection - The procedure collection type
 */
export type GetProceduresFromCollection<TCollection> = TCollection extends ProcedureCollection
  ? TCollection['procedures']
  : never;

// ============================================================================
// Hook Options Types
// ============================================================================

/**
 * Options for useQuery hook
 *
 * Omits queryKey and queryFn since those are provided automatically
 * based on the procedure namespace, name, and input.
 *
 * @template TData - The expected response data type
 * @template TError - The error type (defaults to Error)
 */
export type VeloxUseQueryOptions<TData, TError = Error> = Omit<
  UseQueryOptions<TData, TError>,
  'queryKey' | 'queryFn'
>;

/**
 * Options for useMutation hook
 *
 * Omits mutationFn since that's provided automatically
 * based on the procedure namespace and name.
 *
 * @template TData - The expected response data type
 * @template TInput - The mutation input type
 * @template TError - The error type (defaults to Error)
 * @template TContext - The mutation context type
 */
export type VeloxUseMutationOptions<TData, TInput, TError = Error, TContext = unknown> = Omit<
  UseMutationOptions<TData, TError, TInput, TContext>,
  'mutationFn'
>;

// ============================================================================
// Query Key Types
// ============================================================================

/**
 * Query key structure for VeloxTS
 *
 * Format: [namespace, procedureName, input?]
 *
 * This structure enables:
 * - Invalidating all queries for a namespace: `['users']`
 * - Invalidating a specific procedure: `['users', 'getUser']`
 * - Invalidating a specific query: `['users', 'getUser', { id: '123' }]`
 */
export type VeloxQueryKey =
  | readonly [string, string]
  | readonly [string, string, Record<string, unknown>];

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Context value provided by VeloxProvider
 *
 * @template TRouter - The router type for type-safe client access
 */
export interface VeloxContextValue<TRouter> {
  /** The typed client instance */
  readonly client: ClientFromRouter<TRouter>;
}

/**
 * Props for VeloxProvider component
 *
 * @template _TRouter - The router type for type-safe client configuration (used for generic inference)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface VeloxProviderProps<_TRouter> {
  /** React children to render within the provider */
  readonly children: React.ReactNode;
  /** Client configuration (baseUrl, headers, etc.) */
  readonly config: ClientConfig;
  /** Optional pre-configured QueryClient instance */
  readonly queryClient?: import('@tanstack/react-query').QueryClient;
}

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export type {
  InferProcedureInput,
  InferProcedureOutput,
  ProcedureCollection,
  ClientConfig,
  ClientFromRouter,
};
