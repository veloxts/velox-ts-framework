/**
 * Type inference utilities for the VeloxTS client
 *
 * Provides type extraction from backend procedure collections to enable
 * full-stack type safety without code generation.
 *
 * @module types
 */

// ============================================================================
// Type Inference from Procedures
// ============================================================================

/**
 * Procedure operation type (matches @veloxts/router)
 */
export type ProcedureType = 'query' | 'mutation';

/**
 * Minimal interface representing a compiled procedure
 *
 * This interface is designed to be structurally compatible with @veloxts/router's
 * CompiledProcedure type, enabling type inference without requiring a direct
 * package dependency. The client only needs the schema types for inference.
 *
 * @template TInput - The validated input type
 * @template TOutput - The handler output type
 *
 * @see {@link https://github.com/veloxts/velox-ts-framework/velox | @veloxts/router CompiledProcedure}
 */
export interface ClientProcedure<TInput = unknown, TOutput = unknown> {
  /** Whether this is a query or mutation */
  readonly type: ProcedureType;
  /** The procedure handler function */
  readonly handler: (args: { input: TInput; ctx: unknown }) => TOutput | Promise<TOutput>;
  /** Input validation schema (if specified) */
  readonly inputSchema?: { parse: (input: unknown) => TInput };
  /** Output validation schema (if specified) */
  readonly outputSchema?: { parse: (output: unknown) => TOutput };
  /** Middleware chain (not used by client, but part of CompiledProcedure) */
  readonly middlewares?: ReadonlyArray<unknown>;
  /** REST route override (not used by client, but part of CompiledProcedure) */
  readonly restOverride?: { method?: string; path?: string };
}

/**
 * Record of named procedures
 *
 * NOTE: Uses `any` for variance compatibility with @veloxts/router's ProcedureRecord
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for variance compatibility
export type ProcedureRecord = Record<string, ClientProcedure<any, any>>;

/**
 * Procedure collection with namespace
 *
 * Matches the structure of @veloxts/router's ProcedureCollection
 */
export interface ProcedureCollection<TProcedures extends ProcedureRecord = ProcedureRecord> {
  /** Resource namespace (e.g., 'users', 'posts') */
  readonly namespace: string;
  /** Named procedures in this collection */
  readonly procedures: TProcedures;
}

/**
 * Extracts the input type from a procedure
 *
 * Works with both ClientProcedure and @veloxts/router's CompiledProcedure
 */
export type InferProcedureInput<T> = T extends ClientProcedure<infer I, unknown> ? I : never;

/**
 * Extracts the output type from a procedure
 *
 * Works with both ClientProcedure and @veloxts/router's CompiledProcedure
 */
export type InferProcedureOutput<T> = T extends ClientProcedure<unknown, infer O> ? O : never;

// ============================================================================
// Router Type Construction
// ============================================================================

/**
 * Builds a callable client interface from a single procedure collection
 *
 * For each procedure, creates a method that:
 * - Takes the procedure's input type as parameter
 * - Returns a Promise of the procedure's output type
 */
export type ClientFromCollection<TCollection extends ProcedureCollection> = {
  [K in keyof TCollection['procedures']]: (
    input: InferProcedureInput<TCollection['procedures'][K]>
  ) => Promise<InferProcedureOutput<TCollection['procedures'][K]>>;
};

/**
 * Builds a complete client interface from a router (collection of collections)
 *
 * For each collection namespace, creates a property with all callable procedures.
 *
 * @example
 * ```typescript
 * // Backend defines:
 * const userProcedures = defineProcedures('users', {
 *   getUser: procedure().input(...).output(...).query(...),
 *   createUser: procedure().input(...).output(...).mutation(...),
 * });
 *
 * // Frontend gets:
 * type Client = ClientFromRouter<{ users: typeof userProcedures }>;
 * // Client = {
 * //   users: {
 * //     getUser: (input: { id: string }) => Promise<User>;
 * //     createUser: (input: CreateUserInput) => Promise<User>;
 * //   }
 * // }
 * ```
 */
export type ClientFromRouter<TRouter> = {
  [K in keyof TRouter]: TRouter[K] extends ProcedureCollection
    ? ClientFromCollection<TRouter[K]>
    : never;
};

// ============================================================================
// Client Configuration Types
// ============================================================================

/**
 * Configuration for creating a client instance
 */
export interface ClientConfig {
  /** Base URL for API requests (e.g., 'https://api.example.com' or '/api') */
  baseUrl: string;

  /**
   * Optional custom headers to include in all requests
   *
   * Can be:
   * - Static object: `{ Authorization: 'Bearer token' }`
   * - Function for dynamic headers: `() => ({ Authorization: `Bearer ${getToken()}` })`
   *
   * When using a function, it's called on each request, allowing dynamic values
   * like auth tokens that may change during the session.
   */
  headers?: Record<string, string> | (() => Record<string, string>);

  /**
   * Optional request interceptor
   * Called before each request is sent
   */
  onRequest?: (url: string, options: RequestInit) => void | Promise<void>;

  /**
   * Optional response interceptor
   * Called after each successful response
   */
  onResponse?: (response: Response) => void | Promise<void>;

  /**
   * Optional error interceptor
   * Called when a request fails or returns an error response
   */
  onError?: (error: ClientError) => void | Promise<void>;

  /**
   * Optional custom fetch implementation
   * Defaults to global fetch
   */
  fetch?: typeof fetch;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Client error with full context about the failed request
 */
export interface ClientError extends Error {
  /** HTTP status code (if available) */
  statusCode?: number;
  /** Error code from server (if available) */
  code?: string;
  /** Original response body (if available) */
  body?: unknown;
  /** URL that was requested */
  url: string;
  /** HTTP method used */
  method: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Internal representation of a procedure call
 */
export interface ProcedureCall {
  /** Namespace (e.g., 'users') */
  namespace: string;
  /** Procedure name (e.g., 'getUser') */
  procedureName: string;
  /** Input data */
  input: unknown;
}

/**
 * HTTP method inferred from procedure name
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
