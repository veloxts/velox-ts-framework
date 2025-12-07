/**
 * BetterAuth Adapter for @veloxts/auth
 *
 * Integrates BetterAuth (https://better-auth.com) with VeloxTS's
 * pluggable authentication system. BetterAuth is a comprehensive,
 * framework-agnostic TypeScript authentication library.
 *
 * @module auth/adapters/better-auth
 *
 * @example
 * ```typescript
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 * import { createBetterAuthAdapter } from '@veloxts/auth/adapters/better-auth';
 * import { betterAuth } from 'better-auth';
 * import { prismaAdapter } from 'better-auth/adapters/prisma';
 *
 * // Create BetterAuth instance
 * const auth = betterAuth({
 *   database: prismaAdapter(prisma, {
 *     provider: 'postgresql',
 *   }),
 *   trustedOrigins: ['http://localhost:3000'],
 *   emailAndPassword: {
 *     enabled: true,
 *   },
 * });
 *
 * // Create adapter
 * const adapter = createBetterAuthAdapter({
 *   name: 'better-auth',
 *   auth,
 *   basePath: '/api/auth',
 * });
 *
 * // Create plugin and register
 * const authPlugin = createAuthAdapterPlugin({
 *   adapter,
 *   config: adapter.config,
 * });
 *
 * app.use(authPlugin);
 * ```
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AdapterRoute, AdapterSessionResult, AuthAdapterConfig } from '../adapter.js';
import { AuthAdapterError, BaseAuthAdapter } from '../adapter.js';

// ============================================================================
// BetterAuth Types
// ============================================================================

/**
 * BetterAuth session user data
 *
 * Represents the user data returned by BetterAuth's getSession.
 */
export interface BetterAuthUser {
  /** Unique user ID */
  id: string;
  /** User email address */
  email: string;
  /** Whether email is verified */
  emailVerified: boolean;
  /** Display name */
  name: string;
  /** Profile image URL */
  image?: string | null;
  /** Account creation timestamp */
  createdAt: Date;
  /** Account update timestamp */
  updatedAt: Date;
}

/**
 * BetterAuth session data
 *
 * Represents the session data returned by BetterAuth's getSession.
 */
export interface BetterAuthSession {
  /** Unique session ID */
  id: string;
  /** User ID that owns this session */
  userId: string;
  /** Session expiration timestamp */
  expiresAt: Date;
  /** Session token */
  token: string;
  /** IP address of session creator */
  ipAddress?: string | null;
  /** User agent of session creator */
  userAgent?: string | null;
  /** Session creation timestamp */
  createdAt: Date;
  /** Session update timestamp */
  updatedAt: Date;
}

/**
 * Result from BetterAuth getSession API
 */
export interface BetterAuthSessionResult {
  /** User data */
  user: BetterAuthUser;
  /** Session data */
  session: BetterAuthSession;
}

/**
 * BetterAuth API interface
 *
 * This is a minimal interface for the parts of BetterAuth API
 * that the adapter uses. The actual BetterAuth instance has
 * more methods, but we only type what we need.
 */
export interface BetterAuthApi {
  /**
   * Get current session from headers
   */
  getSession(options: { headers: Headers }): Promise<BetterAuthSessionResult | null>;
}

/**
 * BetterAuth handler function type
 *
 * The handler processes auth requests and returns a Response object.
 */
export type BetterAuthHandler = (request: Request) => Promise<Response>;

/**
 * BetterAuth instance interface
 *
 * This represents the object returned by `betterAuth()`.
 * We don't import the actual types to avoid requiring better-auth
 * as a dependency - it's a peer dependency.
 */
export interface BetterAuthInstance {
  /** API methods for programmatic access */
  api: BetterAuthApi;
  /** Handler for processing auth requests */
  handler: BetterAuthHandler;
  /** Base path for auth routes (configured in betterAuth options) */
  options?: {
    basePath?: string;
  };
}

// ============================================================================
// Adapter Configuration
// ============================================================================

/**
 * BetterAuth adapter configuration
 *
 * @example
 * ```typescript
 * const config: BetterAuthAdapterConfig = {
 *   name: 'better-auth',
 *   auth: betterAuth({ ... }),
 *   basePath: '/api/auth',
 *   debug: true,
 * };
 * ```
 */
export interface BetterAuthAdapterConfig extends AuthAdapterConfig {
  /**
   * BetterAuth instance
   *
   * Created using `betterAuth()` from the 'better-auth' package.
   */
  auth: BetterAuthInstance;

  /**
   * Base path for auth routes
   *
   * This should match the basePath configured in your BetterAuth options.
   * Routes will be mounted at `${basePath}/*`.
   *
   * @default '/api/auth'
   */
  basePath?: string;

  /**
   * Whether to handle all HTTP methods
   *
   * When true, mounts routes for GET, POST, PUT, PATCH, DELETE.
   * When false, only mounts GET and POST (BetterAuth's primary methods).
   *
   * @default false
   */
  handleAllMethods?: boolean;
}

// ============================================================================
// BetterAuth Adapter Implementation
// ============================================================================

/**
 * BetterAuth Adapter
 *
 * Integrates BetterAuth with VeloxTS by:
 * - Mounting BetterAuth's handler at the configured base path
 * - Loading sessions from BetterAuth on each request
 * - Transforming BetterAuth's user/session to VeloxTS format
 *
 * @example
 * ```typescript
 * const adapter = new BetterAuthAdapter();
 * const plugin = createAuthAdapterPlugin({
 *   adapter,
 *   config: {
 *     name: 'better-auth',
 *     auth: betterAuth({ ... }),
 *   },
 * });
 * ```
 */
export class BetterAuthAdapter extends BaseAuthAdapter<BetterAuthAdapterConfig> {
  private auth: BetterAuthInstance | null = null;
  private basePath: string = '/api/auth';
  private handleAllMethods: boolean = false;

  constructor() {
    super('better-auth', '1.0.0');
  }

  /**
   * Initialize the adapter with BetterAuth instance
   */
  override async initialize(
    fastify: FastifyInstance,
    config: BetterAuthAdapterConfig
  ): Promise<void> {
    await super.initialize(fastify, config);

    if (!config.auth) {
      throw new AuthAdapterError(
        'BetterAuth instance is required in adapter config',
        500,
        'ADAPTER_NOT_CONFIGURED'
      );
    }

    this.auth = config.auth;
    this.basePath = config.basePath ?? config.auth.options?.basePath ?? '/api/auth';
    this.handleAllMethods = config.handleAllMethods ?? false;

    this.debug(`Initialized with basePath: ${this.basePath}`);
  }

  /**
   * Get session from BetterAuth
   *
   * Calls BetterAuth's getSession API with the request headers
   * and transforms the result to VeloxTS format.
   */
  override async getSession(request: FastifyRequest): Promise<AdapterSessionResult | null> {
    if (!this.auth) {
      throw new AuthAdapterError(
        'BetterAuth adapter not initialized',
        500,
        'ADAPTER_NOT_CONFIGURED'
      );
    }

    try {
      // Convert Fastify headers to standard Headers
      const headers = convertToWebHeaders(request.headers);

      // Get session from BetterAuth
      const result = await this.auth.api.getSession({ headers });

      if (!result) {
        this.debug('No session found');
        return null;
      }

      this.debug(`Session found for user: ${result.user.id}`);

      // Transform to VeloxTS format
      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          emailVerified: result.user.emailVerified,
          image: result.user.image ?? undefined,
          providerData: {
            createdAt: result.user.createdAt,
            updatedAt: result.user.updatedAt,
          },
        },
        session: {
          sessionId: result.session.id,
          userId: result.session.userId,
          expiresAt: result.session.expiresAt.getTime(),
          isActive: true,
          providerData: {
            token: result.session.token,
            ipAddress: result.session.ipAddress,
            userAgent: result.session.userAgent,
            createdAt: result.session.createdAt,
            updatedAt: result.session.updatedAt,
          },
        },
      };
    } catch (error) {
      this.error('Failed to get session', error instanceof Error ? error : undefined);

      throw new AuthAdapterError(
        'Failed to load session from BetterAuth',
        500,
        'ADAPTER_SESSION_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get routes for BetterAuth handler
   *
   * Mounts a wildcard route at the base path that forwards
   * all requests to BetterAuth's handler.
   */
  override getRoutes(): AdapterRoute[] {
    const methods = this.handleAllMethods
      ? (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const)
      : (['GET', 'POST'] as const);

    return [
      {
        path: `${this.basePath}/*`,
        methods: [...methods],
        description: 'BetterAuth handler routes',
        handler: this.createHandler(),
      },
    ];
  }

  /**
   * Create the Fastify route handler
   *
   * Converts Fastify request/reply to Web Request/Response
   * and delegates to BetterAuth's handler.
   */
  private createHandler(): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!this.auth) {
        throw new AuthAdapterError(
          'BetterAuth adapter not initialized',
          500,
          'ADAPTER_NOT_CONFIGURED'
        );
      }

      try {
        // Convert Fastify request to Web Request
        const webRequest = convertToWebRequest(request);

        // Call BetterAuth handler
        const response = await this.auth.handler(webRequest);

        // Convert Web Response to Fastify reply
        await sendWebResponse(reply, response);
      } catch (error) {
        this.error('Handler error', error instanceof Error ? error : undefined);

        throw new AuthAdapterError(
          'BetterAuth handler failed',
          500,
          'ADAPTER_ROUTE_ERROR',
          error instanceof Error ? error : undefined
        );
      }
    };
  }

  /**
   * Clean up adapter resources
   */
  override async cleanup(): Promise<void> {
    await super.cleanup();
    this.auth = null;
    this.debug('Adapter cleaned up');
  }
}

// ============================================================================
// Request/Response Conversion Utilities
// ============================================================================

/**
 * Convert Fastify headers to Web API Headers
 *
 * @param fastifyHeaders - Headers from Fastify request
 * @returns Web API Headers object
 *
 * @internal
 */
function convertToWebHeaders(fastifyHeaders: FastifyRequest['headers']): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(fastifyHeaders)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        for (const v of value) {
          headers.append(key, v);
        }
      } else {
        headers.set(key, value);
      }
    }
  }

  return headers;
}

/**
 * Convert Fastify request to Web API Request
 *
 * @param request - Fastify request object
 * @returns Web API Request object
 *
 * @internal
 */
function convertToWebRequest(request: FastifyRequest): Request {
  const protocol = request.protocol || 'http';
  const host = request.hostname || 'localhost';
  const url = `${protocol}://${host}${request.url}`;

  const headers = convertToWebHeaders(request.headers);

  // Handle request body based on method
  const method = request.method.toUpperCase();
  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method);

  let body: string | Buffer | undefined;
  if (hasBody && request.body !== undefined) {
    // Body could be various types - serialize appropriately
    if (typeof request.body === 'string') {
      body = request.body;
    } else if (Buffer.isBuffer(request.body)) {
      body = request.body;
    } else {
      // Assume JSON-serializable object
      body = JSON.stringify(request.body);
      // Ensure content-type is set for JSON
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }
  }

  return new Request(url, {
    method,
    headers,
    body,
  });
}

/**
 * Send Web API Response through Fastify reply
 *
 * @param reply - Fastify reply object
 * @param response - Web API Response object
 *
 * @internal
 */
async function sendWebResponse(reply: FastifyReply, response: Response): Promise<void> {
  // Set status code
  reply.status(response.status);

  // Set headers
  response.headers.forEach((value, key) => {
    // Skip headers that Fastify handles internally
    if (key.toLowerCase() === 'transfer-encoding') {
      return;
    }
    reply.header(key, value);
  });

  // Send body
  if (response.body) {
    const body = await response.text();
    if (body) {
      reply.send(body);
    } else {
      reply.send();
    }
  } else {
    reply.send();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a BetterAuth adapter
 *
 * This is the recommended way to create a BetterAuth adapter.
 * It returns an adapter instance with the configuration attached.
 *
 * @param config - Adapter configuration
 * @returns BetterAuth adapter with configuration
 *
 * @example
 * ```typescript
 * import { createBetterAuthAdapter } from '@veloxts/auth/adapters/better-auth';
 * import { createAuthAdapterPlugin } from '@veloxts/auth';
 * import { betterAuth } from 'better-auth';
 *
 * const auth = betterAuth({
 *   database: prismaAdapter(prisma, { provider: 'postgresql' }),
 *   trustedOrigins: ['http://localhost:3000'],
 *   emailAndPassword: { enabled: true },
 * });
 *
 * const adapter = createBetterAuthAdapter({
 *   name: 'better-auth',
 *   auth,
 *   debug: process.env.NODE_ENV === 'development',
 * });
 *
 * const authPlugin = createAuthAdapterPlugin({
 *   adapter,
 *   config: adapter.config,
 * });
 *
 * app.use(authPlugin);
 * ```
 */
export function createBetterAuthAdapter(
  config: BetterAuthAdapterConfig
): BetterAuthAdapter & { config: BetterAuthAdapterConfig } {
  const adapter = new BetterAuthAdapter();

  // Attach config for easy access when creating plugin
  return Object.assign(adapter, { config });
}

// ============================================================================
// Re-exports
// ============================================================================

export { AuthAdapterError } from '../adapter.js';
