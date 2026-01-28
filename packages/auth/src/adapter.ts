/**
 * Pluggable Authentication Adapter System for @veloxts/auth
 *
 * This module provides a flexible adapter interface for integrating external
 * authentication providers (BetterAuth, Clerk, Auth0, etc.) with VeloxTS.
 *
 * The adapter system abstracts provider-specific logic while maintaining
 * full type safety and integration with VeloxTS's existing auth infrastructure.
 *
 * @module auth/adapter
 *
 * @example
 * ```typescript
 * import { createAuthAdapterPlugin, defineAuthAdapter } from '@veloxts/auth';
 * import { betterAuth } from 'better-auth';
 *
 * // Create a BetterAuth adapter
 * const betterAuthAdapter = defineBetterAuthAdapter({
 *   auth: betterAuth({ database, trustedOrigins: [...] }),
 * });
 *
 * // Create the plugin
 * const authPlugin = createAuthAdapterPlugin(betterAuthAdapter);
 *
 * // Register with VeloxApp
 * app.use(authPlugin);
 * ```
 */

import type { BaseContext, VeloxPlugin } from '@veloxts/core';
import type { MiddlewareFunction } from '@veloxts/router';
import type { FastifyInstance, FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';

import { checkDoubleRegistration, decorateAuth, setRequestAuth } from './decoration.js';
import type { AuthContext, AdapterAuthContext as TypesAdapterAuthContext, User } from './types.js';
import { AuthError } from './types.js';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes specific to auth adapter operations
 */
export type AuthAdapterErrorCode =
  | 'ADAPTER_INIT_FAILED'
  | 'ADAPTER_SESSION_ERROR'
  | 'ADAPTER_ROUTE_ERROR'
  | 'ADAPTER_CALLBACK_ERROR'
  | 'ADAPTER_USER_TRANSFORM_ERROR'
  | 'ADAPTER_NOT_CONFIGURED'
  | 'ADAPTER_PROVIDER_ERROR';

/**
 * Authentication adapter error
 *
 * Extends AuthError with adapter-specific error codes for
 * better error handling and debugging.
 *
 * @example
 * ```typescript
 * throw new AuthAdapterError(
 *   'Failed to initialize BetterAuth adapter',
 *   500,
 *   'ADAPTER_INIT_FAILED',
 *   originalError
 * );
 * ```
 */
export class AuthAdapterError extends AuthError {
  /** Original error from the auth provider (if available) */
  readonly cause?: Error;

  /** Adapter-specific error code */
  override readonly code: AuthAdapterErrorCode;

  constructor(message: string, statusCode: number, code: AuthAdapterErrorCode, cause?: Error) {
    super(message, statusCode, code);
    this.name = 'AuthAdapterError';
    this.code = code;
    this.cause = cause;
    Error.captureStackTrace?.(this, AuthAdapterError);
  }
}

// ============================================================================
// Session Result Types
// ============================================================================

/**
 * Raw session data from the auth provider
 *
 * Auth providers return different session structures. This interface
 * defines a normalized representation that adapters transform provider
 * data into.
 *
 * @example
 * ```typescript
 * // BetterAuth returns
 * { user: { id, email, name }, session: { id, expiresAt } }
 *
 * // Clerk returns
 * { userId, sessionId, claims }
 *
 * // Adapters normalize to AdapterSession
 * ```
 */
export interface AdapterSession {
  /** Session ID from the provider */
  sessionId: string;

  /** User ID from the provider */
  userId: string;

  /** Session expiration timestamp (Unix ms) */
  expiresAt?: number;

  /** Whether the session is currently active */
  isActive: boolean;

  /**
   * Provider-specific session data
   *
   * Adapters can store additional data from their provider here.
   * This data is available but not guaranteed to follow any structure.
   */
  providerData?: Record<string, unknown>;
}

/**
 * User data from the auth provider
 *
 * Auth providers return different user structures. This interface
 * defines the raw user data before transformation to VeloxTS User.
 */
export interface AdapterUser {
  /** User ID from the provider */
  id: string;

  /** User email (required for VeloxTS User compatibility) */
  email: string;

  /** Display name (optional) */
  name?: string;

  /** Email verification status */
  emailVerified?: boolean;

  /** Profile image URL */
  image?: string;

  /**
   * Provider-specific user data
   *
   * Adapters can store additional data from their provider here.
   */
  providerData?: Record<string, unknown>;
}

/**
 * Result of loading a session from the auth provider
 *
 * This is the primary return type from adapter.getSession().
 * Contains both user and session data in a normalized format.
 */
export interface AdapterSessionResult {
  /** User data from the provider */
  user: AdapterUser;

  /** Session data from the provider */
  session: AdapterSession;
}

// ============================================================================
// Route Handling Types
// ============================================================================

/**
 * HTTP methods supported by auth adapters
 */
export type AdapterHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

/**
 * Route configuration for adapter-provided routes
 *
 * Auth providers often need to mount their own routes (e.g., `/api/auth/*`).
 * This interface defines how those routes are configured.
 *
 * @example
 * ```typescript
 * const routes: AdapterRoute[] = [
 *   {
 *     path: '/api/auth/*',
 *     methods: ['GET', 'POST'],
 *     handler: async (request, reply) => {
 *       return auth.handler(request, reply);
 *     },
 *   },
 * ];
 * ```
 */
export interface AdapterRoute {
  /**
   * Route path pattern
   *
   * Supports Fastify path patterns including:
   * - Static paths: `/api/auth/login`
   * - Parametric paths: `/api/auth/callback/:provider`
   * - Wildcard paths: `/api/auth/*`
   */
  path: string;

  /**
   * HTTP methods this route handles
   *
   * If not specified, defaults to all methods.
   */
  methods?: AdapterHttpMethod[];

  /**
   * Route handler function
   *
   * Receives Fastify request and reply objects.
   * The adapter is responsible for returning the appropriate response.
   */
  handler: RouteHandlerMethod;

  /**
   * Optional route description for documentation
   */
  description?: string;
}

// ============================================================================
// Adapter Configuration Types
// ============================================================================

/**
 * Base configuration shared by all auth adapters
 *
 * Individual adapters extend this with provider-specific configuration.
 *
 * @example
 * ```typescript
 * interface BetterAuthAdapterConfig extends AuthAdapterConfig {
 *   auth: BetterAuthInstance;
 *   trustedOrigins?: string[];
 * }
 * ```
 */
export interface AuthAdapterConfig {
  /**
   * Adapter name for identification and logging (optional)
   *
   * Should be a unique identifier like 'better-auth', 'clerk', 'auth0'.
   * If not provided, the factory function or adapter class will supply a default.
   */
  name?: string;

  /**
   * Enable debug logging
   *
   * When true, the adapter logs detailed information about
   * session loading, route handling, and errors.
   *
   * @default false
   */
  debug?: boolean;

  /**
   * Transform adapter user to VeloxTS User
   *
   * Override this to customize how provider user data is
   * transformed to the VeloxTS User interface.
   *
   * @param adapterUser - Raw user data from the provider
   * @returns VeloxTS User object
   *
   * @example
   * ```typescript
   * transformUser: (adapterUser) => ({
   *   id: adapterUser.id,
   *   email: adapterUser.email,
   *   role: adapterUser.providerData?.role as string || 'user',
   *   permissions: adapterUser.providerData?.permissions as string[] || [],
   * })
   * ```
   */
  transformUser?: (adapterUser: AdapterUser) => User;

  /**
   * Routes to exclude from automatic session loading
   *
   * Useful for health check endpoints or public routes that
   * should not trigger session loading.
   *
   * @example
   * ```typescript
   * excludeRoutes: ['/api/health', '/api/public/*']
   * ```
   */
  excludeRoutes?: string[];

  /**
   * Custom error handler for adapter errors
   *
   * Override to customize error responses sent to clients.
   */
  onError?: (
    error: AuthAdapterError,
    request: FastifyRequest,
    reply: FastifyReply
  ) => void | Promise<void>;
}

// ============================================================================
// Auth Adapter Interface
// ============================================================================

/**
 * Authentication adapter interface
 *
 * This is the core contract that all auth adapters must implement.
 * Adapters abstract the specifics of each auth provider while providing
 * a consistent interface for VeloxTS.
 *
 * **Lifecycle:**
 * 1. `initialize()` - Called once when plugin registers
 * 2. `getRoutes()` - Returns routes to mount (if any)
 * 3. `getSession()` - Called on each request to load session
 * 4. `cleanup()` - Called on server shutdown
 *
 * @template TConfig - Adapter-specific configuration type
 *
 * @example
 * ```typescript
 * const myAdapter: AuthAdapter<MyAdapterConfig> = {
 *   name: 'my-adapter',
 *   version: '1.0.0',
 *
 *   async initialize(fastify, config) {
 *     // Setup provider client
 *   },
 *
 *   async getSession(request) {
 *     // Load session from provider
 *     const session = await provider.getSession(request);
 *     if (!session) return null;
 *
 *     return {
 *       user: { id: session.user.id, email: session.user.email },
 *       session: { sessionId: session.id, userId: session.user.id, isActive: true },
 *     };
 *   },
 *
 *   getRoutes() {
 *     return [{ path: '/api/auth/*', handler: providerHandler }];
 *   },
 *
 *   async cleanup() {
 *     // Cleanup resources
 *   },
 * };
 * ```
 */
export interface AuthAdapter<TConfig extends AuthAdapterConfig = AuthAdapterConfig> {
  /**
   * Unique adapter name
   *
   * Used for logging, error messages, and plugin identification.
   */
  readonly name: string;

  /**
   * Adapter version
   *
   * Semantic versioning recommended.
   */
  readonly version: string;

  /**
   * Initialize the adapter
   *
   * Called once when the plugin is registered with Fastify.
   * Use this to set up provider clients, validate configuration,
   * and prepare any resources needed for session loading.
   *
   * @param fastify - Fastify server instance
   * @param config - Adapter configuration
   * @throws {AuthAdapterError} If initialization fails
   */
  initialize(fastify: FastifyInstance, config: TConfig): Promise<void> | void;

  /**
   * Load session from the current request
   *
   * Called on each request (unless excluded) to determine the
   * current user's session. This is the primary method adapters
   * must implement.
   *
   * **Implementation notes:**
   * - Return `null` if no session exists (unauthenticated)
   * - Validate session expiration before returning
   * - Handle provider errors gracefully
   *
   * @param request - Fastify request object
   * @returns Session result or null if not authenticated
   * @throws {AuthAdapterError} If session loading fails
   *
   * @example
   * ```typescript
   * async getSession(request) {
   *   try {
   *     const result = await provider.getSession({
   *       headers: fromNodeHeaders(request.headers),
   *     });
   *
   *     if (!result) return null;
   *
   *     return {
   *       user: {
   *         id: result.user.id,
   *         email: result.user.email,
   *         name: result.user.name,
   *       },
   *       session: {
   *         sessionId: result.session.id,
   *         userId: result.user.id,
   *         expiresAt: new Date(result.session.expiresAt).getTime(),
   *         isActive: true,
   *       },
   *     };
   *   } catch (error) {
   *     throw new AuthAdapterError(
   *       'Failed to load session',
   *       500,
   *       'ADAPTER_SESSION_ERROR',
   *       error instanceof Error ? error : undefined
   *     );
   *   }
   * }
   * ```
   */
  getSession(
    request: FastifyRequest
  ): Promise<AdapterSessionResult | null> | AdapterSessionResult | null;

  /**
   * Get routes to mount on the Fastify server
   *
   * Many auth providers need their own routes for:
   * - Login/logout endpoints
   * - OAuth callbacks
   * - Magic link handlers
   * - Session management
   *
   * Return an empty array if no routes are needed.
   *
   * @returns Array of route configurations
   *
   * @example
   * ```typescript
   * getRoutes() {
   *   return [
   *     {
   *       path: '/api/auth/*',
   *       methods: ['GET', 'POST'],
   *       handler: async (request, reply) => {
   *         return provider.handler(request.raw, reply.raw);
   *       },
   *       description: 'BetterAuth handler',
   *     },
   *   ];
   * }
   * ```
   */
  getRoutes(): AdapterRoute[];

  /**
   * Handle OAuth or other callback requests (optional)
   *
   * Some providers require special handling for callbacks.
   * Implement this if your provider needs custom callback logic
   * beyond what getRoutes() provides.
   *
   * @param request - Fastify request object
   * @param reply - Fastify reply object
   * @param callbackType - Type of callback (e.g., 'oauth', 'magic-link')
   * @returns Response data or void if reply was already sent
   */
  handleCallback?(
    request: FastifyRequest,
    reply: FastifyReply,
    callbackType: string
  ): Promise<unknown> | unknown;

  /**
   * Clean up adapter resources
   *
   * Called during server shutdown. Use this to close connections,
   * clear caches, or perform any necessary cleanup.
   *
   * @example
   * ```typescript
   * async cleanup() {
   *   await providerClient.close();
   *   console.log('Adapter resources cleaned up');
   * }
   * ```
   */
  cleanup?(): Promise<void> | void;

  /**
   * Validate session (optional)
   *
   * Override to add custom session validation logic beyond
   * what getSession() provides.
   *
   * @param session - Session to validate
   * @returns true if session is valid
   */
  validateSession?(session: AdapterSessionResult): Promise<boolean> | boolean;

  /**
   * Refresh session (optional)
   *
   * Override to support session refresh/extension.
   *
   * @param request - Fastify request object
   * @param session - Current session to refresh
   * @returns Updated session or null if refresh failed
   */
  refreshSession?(
    request: FastifyRequest,
    session: AdapterSessionResult
  ): Promise<AdapterSessionResult | null> | AdapterSessionResult | null;
}

// ============================================================================
// Adapter Factory
// ============================================================================

/**
 * Defines an auth adapter with proper typing
 *
 * This is a helper function that provides better TypeScript inference
 * and validates adapter implementation at definition time.
 *
 * @template TConfig - Adapter-specific configuration type
 * @param adapter - Adapter implementation
 * @returns The same adapter with proper types
 *
 * @example
 * ```typescript
 * interface BetterAuthConfig extends AuthAdapterConfig {
 *   auth: BetterAuthInstance;
 * }
 *
 * export const betterAuthAdapter = defineAuthAdapter<BetterAuthConfig>({
 *   name: 'better-auth',
 *   version: '1.0.0',
 *
 *   async initialize(fastify, config) {
 *     // Store auth instance for later use
 *   },
 *
 *   async getSession(request) {
 *     // Load session using BetterAuth
 *   },
 *
 *   getRoutes() {
 *     return [{ path: '/api/auth/*', handler: ... }];
 *   },
 * });
 * ```
 */
export function defineAuthAdapter<TConfig extends AuthAdapterConfig = AuthAdapterConfig>(
  adapter: AuthAdapter<TConfig>
): AuthAdapter<TConfig> {
  // Validate adapter at definition time
  validateAdapter(adapter);
  return adapter;
}

/**
 * Validates an adapter implementation
 *
 * @param adapter - Adapter to validate
 * @throws {AuthAdapterError} If adapter is invalid
 *
 * @internal
 */
function validateAdapter(adapter: AuthAdapter<AuthAdapterConfig>): void {
  if (!adapter.name || typeof adapter.name !== 'string') {
    throw new AuthAdapterError('Adapter must have a name', 500, 'ADAPTER_NOT_CONFIGURED');
  }

  if (!adapter.version || typeof adapter.version !== 'string') {
    throw new AuthAdapterError(
      `Adapter "${adapter.name}" must have a version`,
      500,
      'ADAPTER_NOT_CONFIGURED'
    );
  }

  if (typeof adapter.initialize !== 'function') {
    throw new AuthAdapterError(
      `Adapter "${adapter.name}" must implement initialize()`,
      500,
      'ADAPTER_NOT_CONFIGURED'
    );
  }

  if (typeof adapter.getSession !== 'function') {
    throw new AuthAdapterError(
      `Adapter "${adapter.name}" must implement getSession()`,
      500,
      'ADAPTER_NOT_CONFIGURED'
    );
  }

  if (typeof adapter.getRoutes !== 'function') {
    throw new AuthAdapterError(
      `Adapter "${adapter.name}" must implement getRoutes()`,
      500,
      'ADAPTER_NOT_CONFIGURED'
    );
  }
}

// ============================================================================
// Plugin Factory
// ============================================================================

/**
 * Plugin options for the auth adapter plugin
 *
 * @deprecated Use the simplified form: `createAuthAdapterPlugin(adapter)` where adapter
 * is created via a factory function like `createClerkAdapter()` that attaches config.
 */
export interface AuthAdapterPluginOptions<TConfig extends AuthAdapterConfig = AuthAdapterConfig> {
  /**
   * The auth adapter instance
   */
  adapter: AuthAdapter<TConfig>;

  /**
   * Adapter-specific configuration
   */
  config: TConfig;
}

/**
 * Adapter with attached configuration (returned by factory functions)
 *
 * Factory functions like `createClerkAdapter()` return an adapter with its
 * configuration attached, enabling the simplified plugin registration:
 * `createAuthAdapterPlugin(adapter)` instead of
 * `createAuthAdapterPlugin({ adapter, config: adapter.config })`
 */
export type AdapterWithConfig<
  TAdapter extends AuthAdapter<TConfig>,
  TConfig extends AuthAdapterConfig = AuthAdapterConfig,
> = TAdapter & { config: TConfig };

/**
 * Default user transformer
 *
 * Transforms AdapterUser to VeloxTS User with basic mapping.
 * Override via config.transformUser for custom behavior.
 */
function defaultTransformUser(adapterUser: AdapterUser): User {
  return {
    id: adapterUser.id,
    email: adapterUser.email,
    // Include optional fields if present
    ...(adapterUser.name !== undefined && { name: adapterUser.name }),
    ...(adapterUser.emailVerified !== undefined && { emailVerified: adapterUser.emailVerified }),
    ...(adapterUser.image !== undefined && { image: adapterUser.image }),
    // Spread provider data (users can access via declaration merging)
    ...adapterUser.providerData,
  };
}

/**
 * Check if a path matches any exclude pattern
 *
 * Supports:
 * - Exact matches: `/api/health`
 * - Wildcard suffixes: `/api/public/*`
 *
 * @param path - Request path to check
 * @param patterns - Patterns to match against
 * @returns true if path matches any pattern
 *
 * @internal
 */
function matchesExcludePattern(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1); // Remove trailing *
      if (path.startsWith(prefix)) {
        return true;
      }
    } else if (path === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Creates a VeloxTS plugin from an auth adapter
 *
 * This factory function wraps an auth adapter in a Fastify plugin
 * that integrates with VeloxTS's plugin system. It handles:
 *
 * - Adapter initialization
 * - Route mounting
 * - Session loading via preHandler hook
 * - Request decoration with auth context
 * - Cleanup on shutdown
 *
 * @template TConfig - Adapter-specific configuration type
 * @param adapterOrOptions - Either an adapter with attached config (from factory), or legacy options object
 * @returns VeloxTS plugin ready for registration
 *
 * @example Simplified API (recommended)
 * ```typescript
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 * import { createClerkAdapter } from '@veloxts/auth/adapters/clerk';
 *
 * const adapter = createClerkAdapter({
 *   clerk: createClerkClient({ secretKey: '...' }),
 *   debug: process.env.NODE_ENV === 'development',
 * });
 *
 * // Simple: just pass the adapter
 * const authPlugin = createAuthAdapterPlugin(adapter);
 *
 * app.use(authPlugin);
 * ```
 *
 * @example Legacy API (still supported)
 * ```typescript
 * const authPlugin = createAuthAdapterPlugin({
 *   adapter: myAdapter,
 *   config: { ... },
 * });
 * ```
 */
export function createAuthAdapterPlugin<TConfig extends AuthAdapterConfig>(
  adapterOrOptions:
    | AdapterWithConfig<AuthAdapter<TConfig>, TConfig>
    | AuthAdapterPluginOptions<TConfig>
): VeloxPlugin<AuthAdapterPluginOptions<TConfig>> {
  // Support both new simplified API and legacy options object
  let adapter: AuthAdapter<TConfig>;
  let config: TConfig;

  if ('adapter' in adapterOrOptions && 'config' in adapterOrOptions) {
    // Legacy: { adapter, config } object
    adapter = adapterOrOptions.adapter;
    config = adapterOrOptions.config;
  } else {
    // New: adapter with attached config
    adapter = adapterOrOptions;
    config = adapterOrOptions.config;
  }
  const debug = config.debug ?? false;
  const excludeRoutes = config.excludeRoutes ?? [];
  const transformUser = config.transformUser ?? defaultTransformUser;

  return {
    name: `@veloxts/auth-adapter:${adapter.name}`,
    version: adapter.version,
    dependencies: ['@veloxts/core'],

    async register(server: FastifyInstance, _opts: AuthAdapterPluginOptions<TConfig>) {
      // Config is already captured from adapter - _opts.config is for legacy override support
      const mergedConfig = _opts?.config ? { ...config, ..._opts.config } : config;

      // Prevent double-registration of auth systems
      checkDoubleRegistration(server, `adapter:${adapter.name}`);

      if (debug) {
        server.log.info(`Registering auth adapter: ${adapter.name}`);
      }

      // Initialize adapter
      try {
        await adapter.initialize(server, mergedConfig);

        if (debug) {
          server.log.info(`Auth adapter "${adapter.name}" initialized`);
        }
      } catch (error) {
        const adapterError = new AuthAdapterError(
          `Failed to initialize adapter "${adapter.name}"`,
          500,
          'ADAPTER_INIT_FAILED',
          error instanceof Error ? error : undefined
        );

        server.log.error(adapterError);
        throw adapterError;
      }

      // Decorate requests with auth context
      decorateAuth(server);

      // Mount adapter routes
      const routes = adapter.getRoutes();
      for (const route of routes) {
        const methods = route.methods ?? [
          'GET',
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
          'OPTIONS',
          'HEAD',
        ];

        for (const method of methods) {
          const routeOptions = {
            method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD',
            url: route.path,
            handler: route.handler,
          };

          server.route(routeOptions);

          if (debug) {
            server.log.debug(`Mounted adapter route: ${method} ${route.path}`);
          }
        }
      }

      // Add preHandler hook for session loading
      server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
        // Skip excluded routes
        if (matchesExcludePattern(request.url, excludeRoutes)) {
          return;
        }

        // Skip adapter's own routes (they handle auth internally)
        for (const route of routes) {
          if (route.path.endsWith('/*')) {
            const prefix = route.path.slice(0, -1);
            if (request.url.startsWith(prefix)) {
              return;
            }
          } else if (request.url === route.path) {
            return;
          }
        }

        try {
          const sessionResult = await adapter.getSession(request);

          if (sessionResult) {
            // Validate session if adapter provides validation
            if (adapter.validateSession) {
              const isValid = await adapter.validateSession(sessionResult);
              if (!isValid) {
                if (debug) {
                  server.log.debug('Session validation failed');
                }
                return;
              }
            }

            // Check session expiration
            if (sessionResult.session.expiresAt) {
              if (sessionResult.session.expiresAt < Date.now()) {
                if (debug) {
                  server.log.debug('Session has expired');
                }
                return;
              }
            }

            // Check if session is active
            if (!sessionResult.session.isActive) {
              if (debug) {
                server.log.debug('Session is not active');
              }
              return;
            }

            // Transform user to VeloxTS User
            let user: User;
            try {
              user = transformUser(sessionResult.user);
            } catch (error) {
              throw new AuthAdapterError(
                'Failed to transform user',
                500,
                'ADAPTER_USER_TRANSFORM_ERROR',
                error instanceof Error ? error : undefined
              );
            }

            // Set auth context on request using AdapterAuthContext
            const authContext: TypesAdapterAuthContext = {
              authMode: 'adapter',
              user,
              isAuthenticated: true,
              providerId: adapter.name,
              session: sessionResult.session.providerData,
            };

            setRequestAuth(request, authContext, user);
          }
        } catch (error) {
          // Handle adapter errors
          if (error instanceof AuthAdapterError) {
            if (mergedConfig.onError) {
              await mergedConfig.onError(error, request, reply);
              return;
            }
            throw error;
          }

          // Wrap unknown errors
          const adapterError = new AuthAdapterError(
            'Session loading failed',
            500,
            'ADAPTER_SESSION_ERROR',
            error instanceof Error ? error : undefined
          );

          if (mergedConfig.onError) {
            await mergedConfig.onError(adapterError, request, reply);
            return;
          }

          if (debug) {
            server.log.error(adapterError);
          }
          // Don't throw - allow request to continue unauthenticated
        }
      });

      // Add cleanup hook
      server.addHook('onClose', async () => {
        if (debug) {
          server.log.info(`Cleaning up auth adapter: ${adapter.name}`);
        }

        try {
          await adapter.cleanup?.();
        } catch (error) {
          server.log.error(
            new AuthAdapterError(
              `Failed to cleanup adapter "${adapter.name}"`,
              500,
              'ADAPTER_INIT_FAILED',
              error instanceof Error ? error : undefined
            )
          );
        }
      });

      if (debug) {
        server.log.info(`Auth adapter "${adapter.name}" registered successfully`);
      }
    },
  };
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Options for adapter-based auth middleware
 */
export interface AdapterMiddlewareOptions {
  /**
   * Allow unauthenticated requests
   *
   * When true, requests without valid sessions continue
   * with ctx.user undefined. When false (default),
   * unauthenticated requests throw a 401 error.
   *
   * @default false
   */
  optional?: boolean;
}

/**
 * Context extension for adapter-based authentication middleware
 *
 * This interface extends the procedure context with auth-related properties
 * when using `createAdapterAuthMiddleware()`.
 *
 * Note: This is different from `AdapterAuthContext` in types.ts, which represents
 * the discriminated union variant for adapter-based authentication on requests.
 */
export interface AdapterMiddlewareContext {
  /** Authenticated user (undefined if optional and not authenticated) */
  user?: User;

  /** Whether the request is authenticated */
  isAuthenticated: boolean;

  /** Auth context from request */
  auth: AuthContext;
}

/**
 * Creates middleware for adapter-based authentication
 *
 * Use this middleware in procedures to require or optionally
 * check authentication via the adapter.
 *
 * @returns Middleware factory functions
 *
 * @example
 * ```typescript
 * const auth = createAdapterAuthMiddleware();
 *
 * // Require authentication
 * const getProfile = procedure()
 *   .use(auth.requireAuth())
 *   .query(async ({ ctx }) => {
 *     return ctx.user; // User is guaranteed to exist
 *   });
 *
 * // Optional authentication
 * const getPosts = procedure()
 *   .use(auth.optionalAuth())
 *   .query(async ({ ctx }) => {
 *     // ctx.user may be undefined
 *     return fetchPosts(ctx.user?.id);
 *   });
 * ```
 */
export function createAdapterAuthMiddleware() {
  /**
   * Creates the middleware function
   */
  function middleware<TInput, TContext extends BaseContext, TOutput>(
    options: AdapterMiddlewareOptions = {}
  ): MiddlewareFunction<TInput, TContext, TContext & AdapterMiddlewareContext, TOutput> {
    return async ({ ctx, next }) => {
      const request = ctx.request;

      // Check if auth was already loaded by preHandler hook
      const auth = request.auth;
      const user = request.user;

      if (!user || !auth?.isAuthenticated) {
        if (options.optional) {
          // Optional auth - continue without user
          // Create a minimal adapter auth context for unauthenticated state
          const authContext: TypesAdapterAuthContext = {
            authMode: 'adapter',
            user: undefined,
            isAuthenticated: false,
            providerId: 'unknown',
            session: undefined,
          };

          return next({
            ctx: {
              ...ctx,
              auth: authContext,
              user: undefined,
              isAuthenticated: false,
            },
          });
        }

        // Required auth - reject
        throw new AuthError('Authentication required', 401, 'UNAUTHORIZED');
      }

      // Continue with authenticated context
      return next({
        ctx: {
          ...ctx,
          auth,
          user,
          isAuthenticated: true,
        },
      });
    };
  }

  /**
   * Shorthand for required authentication
   */
  function requireAuth<TInput, TContext extends BaseContext, TOutput>(): MiddlewareFunction<
    TInput,
    TContext,
    TContext & { user: User; isAuthenticated: true; auth: AuthContext },
    TOutput
  > {
    return middleware({ optional: false }) as MiddlewareFunction<
      TInput,
      TContext,
      TContext & { user: User; isAuthenticated: true; auth: AuthContext },
      TOutput
    >;
  }

  /**
   * Shorthand for optional authentication
   */
  function optionalAuth<TInput, TContext extends BaseContext, TOutput>(): MiddlewareFunction<
    TInput,
    TContext,
    TContext & { user?: User; isAuthenticated: boolean; auth: AuthContext },
    TOutput
  > {
    return middleware({ optional: true });
  }

  return {
    middleware,
    requireAuth,
    optionalAuth,
  };
}

// ============================================================================
// Type Utilities
// ============================================================================

/**
 * Infers the configuration type from an adapter
 *
 * @template T - Adapter type
 *
 * @example
 * ```typescript
 * const myAdapter = defineAuthAdapter<MyConfig>({ ... });
 * type Config = InferAdapterConfig<typeof myAdapter>;
 * // Config = MyConfig
 * ```
 */
export type InferAdapterConfig<T> = T extends AuthAdapter<infer C> ? C : never;

/**
 * Type guard to check if a value is a valid AuthAdapter
 *
 * @param value - Value to check
 * @returns true if value is a valid AuthAdapter
 *
 * @example
 * ```typescript
 * if (isAuthAdapter(maybeAdapter)) {
 *   const plugin = createAuthAdapterPlugin({
 *     adapter: maybeAdapter,
 *     config: { name: 'test' },
 *   });
 * }
 * ```
 */
export function isAuthAdapter(value: unknown): value is AuthAdapter {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'name' in value &&
    'version' in value &&
    'initialize' in value &&
    'getSession' in value &&
    'getRoutes' in value &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    typeof value.initialize === 'function' &&
    typeof value.getSession === 'function' &&
    typeof value.getRoutes === 'function'
  );
}

// ============================================================================
// Abstract Base Adapter
// ============================================================================

/**
 * Abstract base class for auth adapters
 *
 * Provides common functionality that most adapters need,
 * reducing boilerplate in adapter implementations.
 *
 * @template TConfig - Adapter-specific configuration type
 *
 * @example
 * ```typescript
 * class MyAdapter extends BaseAuthAdapter<MyConfig> {
 *   constructor() {
 *     super('my-adapter', '1.0.0');
 *   }
 *
 *   async initialize(fastify: FastifyInstance, config: MyConfig) {
 *     // Custom initialization
 *   }
 *
 *   async getSession(request: FastifyRequest) {
 *     // Custom session loading
 *   }
 *
 *   getRoutes() {
 *     return []; // Or custom routes
 *   }
 * }
 * ```
 */
export abstract class BaseAuthAdapter<TConfig extends AuthAdapterConfig = AuthAdapterConfig>
  implements AuthAdapter<TConfig>
{
  readonly name: string;
  readonly version: string;

  protected fastify: FastifyInstance | null = null;
  protected config: TConfig | null = null;

  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
  }

  /**
   * Initialize the adapter
   *
   * Stores fastify and config references for subclass use.
   * Override in subclass but call super.initialize() first.
   */
  async initialize(fastify: FastifyInstance, config: TConfig): Promise<void> {
    this.fastify = fastify;
    this.config = config;
  }

  /**
   * Get session from request
   *
   * Must be implemented by subclass.
   */
  abstract getSession(
    request: FastifyRequest
  ): Promise<AdapterSessionResult | null> | AdapterSessionResult | null;

  /**
   * Get routes to mount
   *
   * Default implementation returns empty array.
   * Override to provide adapter-specific routes.
   */
  getRoutes(): AdapterRoute[] {
    return [];
  }

  /**
   * Clean up adapter resources
   *
   * Default implementation does nothing.
   * Override to clean up provider resources.
   */
  async cleanup(): Promise<void> {
    this.fastify = null;
    this.config = null;
  }

  /**
   * Log a debug message (if debug is enabled)
   */
  protected debug(message: string): void {
    if (this.config?.debug && this.fastify) {
      this.fastify.log.debug(`[${this.name}] ${message}`);
    }
  }

  /**
   * Log an info message (if debug is enabled)
   */
  protected info(message: string): void {
    if (this.config?.debug && this.fastify) {
      this.fastify.log.info(`[${this.name}] ${message}`);
    }
  }

  /**
   * Log an error
   */
  protected error(message: string, cause?: Error): void {
    if (this.fastify) {
      const errorMessage = cause
        ? `[${this.name}] ${message}: ${cause.message}`
        : `[${this.name}] ${message}`;
      this.fastify.log.error(errorMessage);
    }
  }
}
