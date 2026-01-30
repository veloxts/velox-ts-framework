/**
 * Type-safe API client implementation
 *
 * Provides a fetch-based client that calls REST endpoints with full type safety
 * inferred from backend procedure definitions.
 *
 * @module client
 */

import { NetworkError, parseErrorResponse } from './errors.js';
import type {
  ClientConfig,
  ClientFromRouter,
  ClientMode,
  HttpMethod,
  ProcedureCall,
  RouteEntry,
  RouteMap,
} from './types.js';

// ============================================================================
// Naming Convention Mapping
// ============================================================================

/**
 * Maps procedure naming convention to HTTP method
 *
 * IMPORTANT: This must stay in sync with @veloxts/validation's PROCEDURE_METHOD_MAP.
 * We duplicate it here to avoid adding @veloxts/validation as a dependency for the
 * lightweight frontend client package.
 *
 * @see {@link @veloxts/validation!PROCEDURE_METHOD_MAP} for the canonical definition
 */
const PROCEDURE_METHOD_MAP: Record<string, HttpMethod> = {
  get: 'GET',
  list: 'GET',
  find: 'GET',
  create: 'POST',
  add: 'POST',
  update: 'PUT',
  edit: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  remove: 'DELETE',
} as const;

/**
 * Pre-compiled regex pattern for path parameters
 *
 * PERFORMANCE: Compiled once at module load instead of per-request.
 * The pattern matches :paramName format (e.g., :id, :userId, :post_id)
 *
 * @internal
 */
const PATH_PARAM_PATTERN = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;

/**
 * Infers HTTP method from procedure name
 *
 * @internal
 */
function inferMethodFromName(procedureName: string): HttpMethod {
  // Check each prefix
  for (const [prefix, method] of Object.entries(PROCEDURE_METHOD_MAP)) {
    if (procedureName.startsWith(prefix)) {
      return method;
    }
  }

  // Default to POST for mutations (conservative default)
  return 'POST';
}

/**
 * Type guard for RouteEntry objects
 *
 * @internal
 */
function isRouteEntry(value: unknown): value is RouteEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'method' in value &&
    'path' in value &&
    typeof (value as RouteEntry).path === 'string'
  );
}

/**
 * Resolves a route mapping to method and path
 *
 * Supports two formats:
 * - Object: { method: 'POST', path: '/auth/register' }
 * - String (legacy): '/auth/register'
 *
 * @internal
 */
function resolveRouteOverride(
  override: RouteEntry | string,
  procedureName: string
): { method: HttpMethod; path: string } {
  if (isRouteEntry(override)) {
    return { method: override.method, path: override.path };
  }
  // Legacy string format - infer method from procedure name
  return { method: inferMethodFromName(procedureName), path: override };
}

/**
 * Builds REST path from namespace and procedure name
 *
 * First checks for explicit route mapping, then falls back to
 * naming convention inference.
 *
 * @example
 * - namespace='users', name='getUser' -> '/users/:id'
 * - namespace='users', name='listUsers' -> '/users'
 * - namespace='posts', name='createPost' -> '/posts'
 * - namespace='auth', name='createAccount', routes={auth:{createAccount:{method:'POST',path:'/auth/register'}}} -> '/auth/register'
 *
 * @internal
 */
function buildRestPath(namespace: string, procedureName: string, routes?: RouteMap): string {
  // Check for explicit route mapping first
  const override = routes?.[namespace]?.[procedureName];
  if (override) {
    const resolved = resolveRouteOverride(override, procedureName);
    return resolved.path;
  }

  // Fall back to naming convention
  const method = inferMethodFromName(procedureName);

  // List operations: /namespace
  if (procedureName.startsWith('list')) {
    return `/${namespace}`;
  }

  // Single resource operations (get, update, delete): /namespace/:id
  if (
    procedureName.startsWith('get') ||
    procedureName.startsWith('update') ||
    procedureName.startsWith('delete')
  ) {
    return `/${namespace}/:id`;
  }

  // Create operations: /namespace
  if (method === 'POST') {
    return `/${namespace}`;
  }

  // Default: /namespace
  return `/${namespace}`;
}

/**
 * Replaces path parameters with actual values from input
 *
 * PERFORMANCE: Uses pre-compiled PATH_PARAM_PATTERN instead of creating
 * a new RegExp on each call. Resets lastIndex for safe reuse.
 *
 * @example
 * - path='/users/:id', input={ id: '123' } -> '/users/123'
 * - path='/posts/:postId/comments/:id', input={ postId: 'abc', id: '456' } -> '/posts/abc/comments/456'
 *
 * @internal
 */
function resolvePathParams(path: string, input: Record<string, unknown>): string {
  // Reset lastIndex for safe reuse of global regex
  PATH_PARAM_PATTERN.lastIndex = 0;

  return path.replace(PATH_PARAM_PATTERN, (_match, paramName: string) => {
    const value = input[paramName];
    if (value === undefined || value === null) {
      throw new Error(`Missing path parameter: ${paramName}`);
    }
    return String(value);
  });
}

/**
 * Builds query string from input object, excluding path params
 *
 * @internal
 */
function buildQueryString(input: Record<string, unknown>, pathParams: Set<string>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    // Skip path parameters
    if (pathParams.has(key)) {
      continue;
    }

    // Skip undefined values
    if (value === undefined) {
      continue;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item));
      }
    } else {
      params.append(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Extracts path parameter names from a path pattern
 *
 * PERFORMANCE: Uses pre-compiled PATH_PARAM_PATTERN instead of creating
 * a new RegExp on each call. Uses matchAll which handles lastIndex internally.
 *
 * @example
 * - '/users/:id' -> Set(['id'])
 * - '/posts/:postId/comments/:commentId' -> Set(['postId', 'commentId'])
 *
 * @internal
 */
function extractPathParams(path: string): Set<string> {
  const params = new Set<string>();

  // matchAll creates an iterator that handles lastIndex internally
  for (const match of path.matchAll(PATH_PARAM_PATTERN)) {
    params.add(match[1]);
  }

  return params;
}

// ============================================================================
// Request Building
// ============================================================================

/**
 * Detects client mode from configuration
 *
 * Auto-detects 'trpc' mode if baseUrl ends with '/trpc'
 *
 * @internal
 */
function detectMode(config: ClientConfig): ClientMode {
  if (config.mode) {
    return config.mode;
  }
  // Auto-detect: if baseUrl ends with /trpc, use tRPC mode
  return config.baseUrl.endsWith('/trpc') ? 'trpc' : 'rest';
}

/**
 * Determines if a procedure is a query based on naming convention
 *
 * @internal
 */
function isQueryProcedure(procedureName: string): boolean {
  return (
    procedureName.startsWith('get') ||
    procedureName.startsWith('list') ||
    procedureName.startsWith('find')
  );
}

/**
 * Builds a tRPC-compatible request
 *
 * - Queries: GET /trpc/namespace.procedure?input={encoded json}
 * - Mutations: POST /trpc/namespace.procedure with JSON body
 *
 * @internal
 */
function buildTrpcRequest(
  call: ProcedureCall,
  baseUrl: string,
  headers: Record<string, string>
): { url: string; options: RequestInit } {
  const procedurePath = `${call.namespace}.${call.procedureName}`;
  const isQuery = isQueryProcedure(call.procedureName);

  if (isQuery) {
    // GET request with input as query parameter
    let url = `${baseUrl}/${procedurePath}`;
    if (call.input != null) {
      const inputParam = encodeURIComponent(JSON.stringify(call.input));
      url = `${url}?input=${inputParam}`;
    }
    return {
      url,
      options: {
        method: 'GET',
        headers,
      },
    };
  }

  // POST request with input as JSON body
  return {
    url: `${baseUrl}/${procedurePath}`,
    options: {
      method: 'POST',
      headers,
      body: call.input != null ? JSON.stringify(call.input) : undefined,
    },
  };
}

/**
 * Resolves both method and path for a procedure call (REST mode)
 *
 * Uses explicit route mapping if available, otherwise falls back to naming convention.
 *
 * @internal
 */
function resolveMethodAndPath(
  namespace: string,
  procedureName: string,
  routes?: RouteMap
): { method: HttpMethod; path: string } {
  // Check for explicit route mapping first
  const override = routes?.[namespace]?.[procedureName];
  if (override) {
    return resolveRouteOverride(override, procedureName);
  }

  // Fall back to naming convention inference
  const method = inferMethodFromName(procedureName);
  const path = buildRestPath(namespace, procedureName, routes);
  return { method, path };
}

/**
 * Builds the full URL and request options for a procedure call
 *
 * Supports two modes:
 * - REST: RESTful paths based on naming conventions
 * - tRPC: tRPC-compatible paths with namespace.procedure format
 *
 * @internal
 */
function buildRequest(
  call: ProcedureCall,
  baseUrl: string,
  config: ClientConfig
): { url: string; options: RequestInit } {
  // Prepare headers - support both static object and dynamic function
  const customHeaders =
    typeof config.headers === 'function' ? config.headers() : (config.headers ?? {});
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // Detect mode and route accordingly
  const mode = detectMode(config);

  if (mode === 'trpc') {
    return buildTrpcRequest(call, baseUrl, headers);
  }

  // REST mode
  const { method, path } = resolveMethodAndPath(call.namespace, call.procedureName, config.routes);

  let finalPath = path;
  let body: string | undefined;

  // Handle input based on method
  if (method === 'GET') {
    // GET: params in URL
    const pathParams = extractPathParams(path);
    const input = (call.input || {}) as Record<string, unknown>;

    // Resolve path parameters
    finalPath = resolvePathParams(path, input);

    // Add query string for remaining parameters
    const queryString = buildQueryString(input, pathParams);
    finalPath = `${finalPath}${queryString}`;
  } else {
    // POST/PUT/PATCH/DELETE: body as JSON
    // But first resolve path params if any
    const pathParams = extractPathParams(path);
    if (pathParams.size > 0 && call.input && typeof call.input === 'object') {
      const input = call.input as Record<string, unknown>;
      finalPath = resolvePathParams(path, input);

      // For POST with path params, body is the input minus path params
      const bodyInput: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        if (!pathParams.has(key)) {
          bodyInput[key] = value;
        }
      }
      body = JSON.stringify(bodyInput);
    } else {
      body = JSON.stringify(call.input);
    }
  }

  // Build full URL
  const url = `${baseUrl}${finalPath}`;

  return {
    url,
    options: {
      method,
      headers,
      body,
    },
  };
}

// ============================================================================
// Client Implementation
// ============================================================================

/**
 * Internal client state
 */
interface ClientState {
  config: ClientConfig;
  fetch: typeof fetch;
}

/**
 * Executes a procedure call against the API
 *
 * @internal
 */
async function executeProcedure(
  call: ProcedureCall,
  state: ClientState,
  isRetry = false
): Promise<unknown> {
  const { url, options } = buildRequest(call, state.config.baseUrl, state.config);

  // Call onRequest interceptor
  if (state.config.onRequest) {
    await state.config.onRequest(url, options);
  }

  let response: Response;

  try {
    response = await state.fetch(url, options);
  } catch (error) {
    // Network error - couldn't reach server
    const networkError = new NetworkError('Network request failed', {
      url,
      method: options.method || 'GET',
      cause: error instanceof Error ? error : undefined,
    });

    // Call onError interceptor
    if (state.config.onError) {
      await state.config.onError(networkError);
    }

    throw networkError;
  }

  // Parse response body
  let body: unknown;
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      // Couldn't parse JSON - use text
      body = await response.text();
    }
  } else {
    body = await response.text();
  }

  // Handle error responses
  if (!response.ok) {
    const error = parseErrorResponse(response, body, url, options.method || 'GET');

    // Handle 401 with automatic retry (only once)
    if (response.status === 401 && !isRetry && state.config.onUnauthorized) {
      try {
        const shouldRetry = await state.config.onUnauthorized();
        if (shouldRetry) {
          // Retry with fresh headers (headers function will be called again)
          return executeProcedure(call, state, true);
        }
      } catch {
        // onUnauthorized threw - continue with original error
      }
    }

    // Call onError interceptor
    if (state.config.onError) {
      await state.config.onError(error);
    }

    throw error;
  }

  // Call onResponse interceptor
  if (state.config.onResponse) {
    await state.config.onResponse(response);
  }

  return body;
}

/**
 * Creates a proxy for a namespace that intercepts procedure calls
 *
 * @internal
 */
function createNamespaceProxy(namespace: string, state: ClientState): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get(_target, procedureName: string) {
        // Return a function that executes the procedure
        return (input: unknown) => {
          return executeProcedure(
            {
              namespace,
              procedureName,
              input,
            },
            state
          );
        };
      },
    }
  );
}

/**
 * Creates the root client proxy
 *
 * @internal
 */
function createClientProxy<TRouter>(state: ClientState): ClientFromRouter<TRouter> {
  return new Proxy(
    {},
    {
      get(_target, namespace: string) {
        return createNamespaceProxy(namespace, state);
      },
    }
  ) as ClientFromRouter<TRouter>;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Creates a type-safe API client for a VeloxTS backend
 *
 * The client uses TypeScript's type system to infer the full API shape from
 * backend procedure definitions, providing autocomplete and compile-time type checking.
 *
 * @template TRouter - The router type (typeof imported procedures)
 * @param config - Client configuration
 * @returns Fully typed API client with namespaced procedures
 *
 * @example
 * ```typescript
 * // Import procedure types from backend
 * import type { userProcedures, postProcedures } from '../server/procedures';
 *
 * // Create client with inferred types
 * const api = createClient<{
 *   users: typeof userProcedures;
 *   posts: typeof postProcedures;
 * }>({
 *   baseUrl: 'https://api.example.com/api',
 * });
 *
 * // Fully typed calls
 * const user = await api.users.getUser({ id: '123' });
 * const newPost = await api.posts.createPost({ title: 'Hello', content: '...' });
 * ```
 *
 * @example
 * ```typescript
 * // With custom configuration
 * const api = createClient<Router>({
 *   baseUrl: '/api',
 *   headers: {
 *     'Authorization': 'Bearer token123',
 *   },
 *   onRequest: async (url, options) => {
 *     console.log(`${options.method} ${url}`);
 *   },
 *   onError: async (error) => {
 *     console.error('API Error:', error.message);
 *   },
 * });
 * ```
 */
export function createClient<TRouter>(config: ClientConfig): ClientFromRouter<TRouter> {
  // Use provided fetch or global fetch
  // IMPORTANT: Bind fetch to globalThis to avoid "Illegal invocation" errors
  // when fetch is called without its original context (window/globalThis)
  const fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);

  // Create client state
  const state: ClientState = {
    config,
    fetch: fetchImpl,
  };

  // Return the proxy-based client
  return createClientProxy<TRouter>(state);
}
