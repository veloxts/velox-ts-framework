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
 * @template TType - The procedure type literal ('query' or 'mutation')
 *
 * @see {@link https://github.com/veloxts/velox-ts-framework/velox | @veloxts/router CompiledProcedure}
 */
export interface ClientProcedure<
  TInput = unknown,
  TOutput = unknown,
  TType extends ProcedureType = ProcedureType,
> {
  /** Whether this is a query or mutation */
  readonly type: TType;
  /** The procedure handler function - uses `any` for ctx to enable contravariant matching with CompiledProcedure */
  // biome-ignore lint/suspicious/noExplicitAny: Required for contravariant type compatibility with router's TContext
  readonly handler: (args: { input: TInput; ctx: any }) => TOutput | Promise<TOutput>;
  /** Input validation schema (if specified) */
  readonly inputSchema?: { parse: (input: unknown) => TInput };
  /** Output validation schema (if specified) */
  readonly outputSchema?: { parse: (output: unknown) => TOutput };
  /** Middleware chain - required for structural compatibility with CompiledProcedure */
  readonly middlewares: ReadonlyArray<unknown>;
  /** Guards - required for structural compatibility with CompiledProcedure */
  readonly guards: ReadonlyArray<unknown>;
  /** REST route override (not used by client, but part of CompiledProcedure) */
  readonly restOverride?: { method?: string; path?: string };
  /** Parent resource configuration for nested routes */
  readonly parentResource?: { namespace: string; paramName: string };
}

/**
 * Record of named procedures
 *
 * NOTE: Uses `any` for variance compatibility with @veloxts/router's ProcedureRecord
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for variance compatibility
export type ProcedureRecord = Record<string, ClientProcedure<any, any, any>>;

/**
 * Procedure collection with namespace
 *
 * Matches the structure of @veloxts/router's ProcedureCollection.
 * The TNamespace parameter captures the literal namespace string for proper
 * type narrowing in router types.
 *
 * @template TNamespace - The literal namespace string (e.g., 'users', 'posts')
 * @template TProcedures - The record of named procedures
 */
export interface ProcedureCollection<
  TNamespace extends string = string,
  TProcedures extends ProcedureRecord = ProcedureRecord,
> {
  /** Resource namespace (e.g., 'users', 'posts') */
  readonly namespace: TNamespace;
  /** Named procedures in this collection */
  readonly procedures: TProcedures;
}

/**
 * Extracts the input type from a procedure
 *
 * Works with both ClientProcedure and @veloxts/router's CompiledProcedure
 */
export type InferProcedureInput<T> =
  T extends ClientProcedure<infer I, unknown, ProcedureType> ? I : never;

/**
 * Extracts the output type from a procedure
 *
 * Works with both ClientProcedure and @veloxts/router's CompiledProcedure
 */
export type InferProcedureOutput<T> =
  T extends ClientProcedure<unknown, infer O, ProcedureType> ? O : never;

/**
 * Extracts the type (query/mutation) from a procedure
 *
 * Works with both ClientProcedure and @veloxts/router's CompiledProcedure
 */
export type InferProcedureType<T> =
  T extends ClientProcedure<unknown, unknown, infer TType> ? TType : never;

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
 * A single route entry with method, path, and procedure kind
 *
 * The `kind` field enables explicit query/mutation type annotation,
 * overriding the naming convention heuristic when procedures don't
 * follow standard prefixes (get*, list*, create*, etc.).
 */
export interface RouteEntry {
  method: HttpMethod;
  path: string;
  /**
   * Explicit procedure type annotation
   *
   * When provided, this overrides the naming convention detection:
   * - `'query'` → enables useQuery, useSuspenseQuery, getQueryKey, etc.
   * - `'mutation'` → enables useMutation
   *
   * Use when procedure names don't follow conventions (e.g., `fetchUsers`, `process`)
   */
  kind?: 'query' | 'mutation';
}

/**
 * Maps procedure names to their REST endpoint configuration.
 *
 * Use when backend procedures have `.rest()` overrides that differ
 * from the default naming convention paths.
 *
 * Supports two formats:
 * - Object format: `{ method: 'POST', path: '/auth/register' }`
 * - String format (legacy): `'/auth/register'` (method inferred from name)
 *
 * @example
 * ```typescript
 * const routes: RouteMap = {
 *   auth: {
 *     createAccount: { method: 'POST', path: '/auth/register' },
 *     createSession: { method: 'POST', path: '/auth/login' },
 *     getMe: { method: 'GET', path: '/auth/me' },
 *   },
 * };
 * ```
 */
export type RouteMap = Record<string, Record<string, RouteEntry | string>>;

/**
 * Client mode determines how URLs are generated
 *
 * - `'rest'` - RESTful URLs based on naming conventions (e.g., GET /users/:id)
 * - `'trpc'` - tRPC-compatible URLs (e.g., GET /trpc/users.getUser?input={...})
 */
export type ClientMode = 'rest' | 'trpc';

/**
 * Configuration for creating a client instance
 */
export interface ClientConfig {
  /** Base URL for API requests (e.g., 'https://api.example.com' or '/api') */
  baseUrl: string;

  /**
   * Client mode: 'rest' or 'trpc'
   *
   * - `'rest'` - Generates RESTful paths based on naming conventions
   *   e.g., `getUser` → `GET /users/:id`, `createUser` → `POST /users`
   *
   * - `'trpc'` - Generates tRPC-compatible paths
   *   e.g., `getUser` → `GET /trpc/users.getUser?input={...}`
   *   e.g., `createUser` → `POST /trpc/users.createUser` with JSON body
   *
   * Auto-detected if not specified:
   * - If `baseUrl` ends with '/trpc', defaults to 'trpc'
   * - Otherwise defaults to 'rest'
   */
  mode?: ClientMode;

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
   * Custom route mappings for procedures with `.rest()` overrides.
   *
   * Use when backend procedures define custom REST paths that differ
   * from the default naming convention inference.
   *
   * @example
   * ```typescript
   * const client = createClient<AppRouter>({
   *   baseUrl: '/api',
   *   routes: {
   *     auth: {
   *       createAccount: '/auth/register',
   *       createSession: '/auth/login',
   *       getMe: '/auth/me',
   *     },
   *   },
   * });
   * ```
   */
  routes?: RouteMap;

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
   * Unauthorized handler for automatic token refresh
   *
   * Called when a request receives a 401 Unauthorized response.
   * Return `true` to retry the request with fresh headers.
   * Return `false` to propagate the original error.
   *
   * The headers function is called fresh for the retry, so update your
   * token storage before returning `true`.
   *
   * @example
   * ```typescript
   * const client = createClient<AppRouter>({
   *   baseUrl: '/api',
   *   headers: () => {
   *     const token = localStorage.getItem('token');
   *     return token ? { Authorization: `Bearer ${token}` } : {};
   *   },
   *   onUnauthorized: async () => {
   *     const refreshToken = localStorage.getItem('refreshToken');
   *     if (!refreshToken) return false;
   *
   *     const res = await fetch('/api/auth/refresh', {
   *       method: 'POST',
   *       headers: { 'Content-Type': 'application/json' },
   *       body: JSON.stringify({ refreshToken }),
   *     });
   *
   *     if (!res.ok) {
   *       localStorage.removeItem('token');
   *       localStorage.removeItem('refreshToken');
   *       return false;
   *     }
   *
   *     const data = await res.json();
   *     localStorage.setItem('token', data.accessToken);
   *     localStorage.setItem('refreshToken', data.refreshToken);
   *     return true; // Retry the original request
   *   },
   * });
   * ```
   */
  onUnauthorized?: () => boolean | Promise<boolean>;

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
