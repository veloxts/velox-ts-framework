/**
 * Main VeloxTS application class
 * Provides Fastify wrapper with plugin system and lifecycle management
 * @module app
 */

import fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyServerOptions,
} from 'fastify';
import fp from 'fastify-plugin';

import { type BaseContext, createContext } from './context.js';
import { type Container, container } from './di/index.js';
import { isVeloxError, VeloxError } from './errors.js';
import type { PluginOptions, VeloxPlugin } from './plugin.js';
import { isFastifyPlugin, isVeloxPlugin, validatePluginMetadata } from './plugin.js';
import { requestLogger } from './plugins/request-logger.js';
import type { StaticOptions } from './plugins/static.js';
import { registerStatic } from './plugins/static.js';
import type { ShutdownHandler } from './types.js';
import { printBanner } from './utils/banner.js';
import type { FrozenVeloxAppConfig, VeloxAppConfig } from './utils/config.js';
import { mergeConfig, validateConfig } from './utils/config.js';
import { LifecycleManager } from './utils/lifecycle.js';

/**
 * Options for starting the server
 */
export interface StartOptions {
  /** Suppress startup banner output (default: false) */
  silent?: boolean;
}

/**
 * Main VeloxTS application instance
 *
 * Wraps Fastify with additional features:
 * - Type-safe plugin system
 * - Request-scoped context
 * - Graceful shutdown handling
 * - Lifecycle management
 *
 * @example
 * ```typescript
 * const app = await veloxApp({
 *   port: 3030,
 *   logger: true
 * });
 *
 * await app.register(myPlugin);
 * await app.start();
 * ```
 */
export class VeloxApp {
  private readonly _server: FastifyInstance;
  private readonly _config: FrozenVeloxAppConfig;
  private readonly _lifecycle: LifecycleManager;
  private readonly _container: Container;
  private _isRunning = false;
  private _address: string | null = null;

  /**
   * Creates a new VeloxApp instance
   *
   * @param config - Application configuration
   * @internal
   */
  constructor(config: VeloxAppConfig) {
    // Merge user config with defaults and validate
    const merged = mergeConfig(config);

    // Validate and freeze configuration
    this._config = validateConfig(merged);

    // Create Fastify instance
    const fastifyOptions: FastifyServerOptions = {
      logger: this._config.logger,
      ...this._config.fastify,
    };

    this._server = fastify(fastifyOptions);

    // Initialize lifecycle manager
    this._lifecycle = new LifecycleManager();

    // Use global container by default
    this._container = container;

    // Attach container to Fastify for request-scoped services
    this._container.attachToFastify(this._server);

    // Set up context decorator
    this._setupContext();

    // Set up error handling
    this._setupErrorHandling();

    // Set up graceful shutdown
    this._setupGracefulShutdown();

    // Register request logger if enabled via environment
    if (process.env.VELOX_REQUEST_LOGGING === 'true') {
      this._server.register(requestLogger);
    }
  }

  /**
   * Underlying Fastify server instance
   *
   * Provides direct access to Fastify for advanced usage.
   * Most users won't need this - use VeloxApp methods instead.
   *
   * @example
   * ```typescript
   * // Access Fastify decorators
   * app.server.hasDecorator('db');
   *
   * // Use Fastify hooks directly
   * app.server.addHook('onRequest', async (request, reply) => {
   *   console.log('Request received:', request.url);
   * });
   * ```
   */
  get server(): FastifyInstance {
    return this._server;
  }

  /**
   * Application configuration (readonly, frozen)
   */
  get config(): FrozenVeloxAppConfig {
    return this._config;
  }

  /**
   * DI container for the application
   *
   * Provides access to the dependency injection container.
   * Use this to register services and resolve dependencies.
   *
   * @example
   * ```typescript
   * import { Injectable, createStringToken } from '@veloxts/core';
   *
   * const DATABASE = createStringToken<DatabaseClient>('DATABASE');
   *
   * @Injectable()
   * class UserService {
   *   constructor(@Inject(DATABASE) private db: DatabaseClient) {}
   * }
   *
   * // Register services
   * app.container.register({
   *   provide: DATABASE,
   *   useFactory: () => createDatabaseClient()
   * });
   *
   * app.container.register({
   *   provide: UserService,
   *   useClass: UserService
   * });
   * ```
   */
  get container(): Container {
    return this._container;
  }

  /**
   * Check if server is currently running
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Server address (host:port) if running, null otherwise
   */
  get address(): string | null {
    return this._address;
  }

  /**
   * Async initialization (called by factory function)
   *
   * @internal - This method is public for factory access but should not be called directly.
   * Use createVeloxApp() instead.
   */
  async initialize(): Promise<void> {
    // Keep empty - ready() must be called in start() after plugins are registered
    // This is a Fastify constraint: plugins must be registered before ready()
  }

  /**
   * Sets up request context decorator
   *
   * Adds `request.context` property to all requests via onRequest hook
   *
   * @internal
   */
  private _setupContext(): void {
    // Create context for each request via direct assignment
    // TypeScript's declaration merging provides type safety
    this._server.addHook('onRequest', async (request, reply) => {
      // Direct assignment is ~100-400ns faster than Object.defineProperty
      // We use a mutable type assertion here because this is the framework's
      // initialization code - the readonly constraint is for user code safety
      (request as { context: BaseContext }).context = createContext(request, reply);
    });
  }

  /**
   * Sets up global error handling
   *
   * Ensures VeloxErrors are serialized with proper status codes
   *
   * @internal
   */
  private _setupErrorHandling(): void {
    this._server.setErrorHandler(async (error, request, reply) => {
      try {
        // Handle ZodError (validation errors) - return 400
        if (error instanceof Error && error.name === 'ZodError' && 'issues' in error) {
          const zodError = error as Error & { issues: Array<{ path: string[]; message: string }> };
          return reply.status(400).send({
            error: 'ValidationError',
            message: 'Validation failed',
            statusCode: 400,
            details: zodError.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          });
        }

        // Handle Prisma unique constraint errors - return 409 Conflict
        if (
          error instanceof Error &&
          error.name === 'PrismaClientKnownRequestError' &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          const prismaError = error as Error & { meta?: { target?: string[] } };
          const fields = prismaError.meta?.target?.join(', ') ?? 'field';
          return reply.status(409).send({
            error: 'ConflictError',
            message: `A record with this ${fields} already exists`,
            statusCode: 409,
          });
        }

        // Only log server errors (5xx), not client errors (4xx)
        const statusCode = isVeloxError(error)
          ? error.statusCode
          : typeof error === 'object' && error !== null && 'statusCode' in error
            ? (error.statusCode as number)
            : 500;

        if (statusCode >= 500) {
          request.log.error(error);
        }

        // Handle VeloxError instances (fast path - most common case)
        if (isVeloxError(error)) {
          return reply.status(error.statusCode).send(error.toJSON());
        }

        // Handle other errors
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        const name = error instanceof Error ? error.name : 'Error';

        return reply.status(statusCode).send({
          error: name,
          message,
          statusCode,
        });
      } catch (handlerError) {
        // Last resort error handling - prevents unhandled rejections
        console.error('Critical error in error handler:', handlerError);
        if (!reply.sent) {
          return reply.status(500).send({
            error: 'InternalServerError',
            message: 'Internal Server Error',
            statusCode: 500,
          });
        }
      }
    });
  }

  /**
   * Sets up graceful shutdown handlers for process signals
   *
   * @internal
   */
  private _setupGracefulShutdown(): void {
    this._lifecycle.setupSignalHandlers(async () => {
      await this.stop();
    });
  }

  /**
   * Registers a plugin with the application
   *
   * Accepts both VeloxPlugin objects and standard FastifyPluginAsync functions.
   * VeloxPlugins provide metadata (name, version, dependencies) for better DX.
   * FastifyPluginAsync functions are registered directly with Fastify.
   *
   * Plugins must be registered before calling `start()`
   *
   * @template Options - Type of options the plugin accepts
   * @param plugin - VeloxPlugin object or FastifyPluginAsync function to register
   * @param options - Options to pass to the plugin
   * @throws {VeloxError} If VeloxPlugin metadata is invalid
   *
   * @example VeloxPlugin (recommended for framework plugins)
   * ```typescript
   * await app.register(databasePlugin, {
   *   connectionString: 'postgresql://...'
   * });
   * ```
   *
   * @example FastifyPluginAsync (for standard Fastify plugins)
   * ```typescript
   * import { rest } from '@veloxts/router';
   *
   * await app.register(rest([userProcedures]), { prefix: '/api' });
   * ```
   */
  async register<Options extends PluginOptions>(
    plugin: VeloxPlugin<Options> | FastifyPluginAsync<Options>,
    options?: Options
  ): Promise<void> {
    // Handle VeloxPlugin objects (with name, version, register)
    if (isVeloxPlugin(plugin)) {
      // Validate plugin metadata
      validatePluginMetadata(plugin);

      // Wrap plugin with fastify-plugin for proper encapsulation
      const wrappedPlugin = fp(plugin.register, {
        name: plugin.name,
        dependencies: plugin.dependencies,
        fastify: '5.x',
      });

      // Register with Fastify
      try {
        await this._server.register(wrappedPlugin, options ?? ({} as Options));
      } catch (error) {
        throw new VeloxError(
          `Failed to register plugin "${plugin.name}": ${error instanceof Error ? error.message : String(error)}`,
          500,
          'PLUGIN_REGISTRATION_ERROR'
        );
      }
      return;
    }

    // Handle FastifyPluginAsync functions (standard Fastify plugins)
    if (isFastifyPlugin<Options>(plugin)) {
      try {
        await this._server.register(plugin, options ?? ({} as Options));
      } catch (error) {
        throw new VeloxError(
          `Failed to register Fastify plugin: ${error instanceof Error ? error.message : String(error)}`,
          500,
          'PLUGIN_REGISTRATION_ERROR'
        );
      }
      return;
    }

    // Invalid plugin type
    throw new VeloxError(
      'Invalid plugin: must be a VeloxPlugin object or FastifyPluginAsync function',
      500,
      'INVALID_PLUGIN_TYPE'
    );
  }

  /**
   * Registers a plugin with the application
   *
   * @deprecated Use `register()` instead. This alias will be removed in v0.9.
   * @template Options - Type of options the plugin accepts
   * @param plugin - Plugin to register
   * @param options - Options to pass to the plugin
   */
  async use<Options extends PluginOptions>(
    plugin: VeloxPlugin<Options> | FastifyPluginAsync<Options>,
    options?: Options
  ): Promise<void> {
    return this.register(plugin, options);
  }

  /**
   * Registers routes with the application
   *
   * This is a convenience method that passes the Fastify server
   * to a route registration function. Designed to work seamlessly
   * with @veloxts/router's registerRestRoutes.
   *
   * Routes must be registered before calling `start()`.
   *
   * @param registrar - Function that registers routes on the server
   *
   * @example
   * ```typescript
   * import { registerRestRoutes } from '@veloxts/router';
   *
   * // Fluent registration
   * app.routes((server) => {
   *   registerRestRoutes(server, [userProcedures, postProcedures], { prefix: '/api' });
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Or with the helper from @veloxts/router
   * import { createRoutesRegistrar } from '@veloxts/router';
   *
   * app.routes(createRoutesRegistrar([users, posts], { prefix: '/api' }));
   * ```
   */
  routes(registrar: (server: FastifyInstance) => void): this {
    registrar(this._server);
    return this;
  }

  /**
   * Serve static files from a directory
   *
   * @param path - Directory containing static files
   * @param options - Serving configuration
   * @returns The app instance for method chaining
   *
   * @example
   * ```typescript
   * // Simple static serving
   * await app.serveStatic('./public');
   *
   * // SPA with client-side routing
   * await app.serveStatic('./dist', { spa: true });
   *
   * // Production configuration
   * await app.serveStatic('./dist', {
   *   spa: true,
   *   prefix: '/assets',
   *   cache: { maxAge: '1y', immutable: true },
   *   exclude: ['/api', '/trpc'],
   * });
   * ```
   */
  async serveStatic(path: string, options: StaticOptions = {}): Promise<this> {
    await registerStatic(this._server, path, options);
    return this;
  }

  /**
   * Starts the server and begins listening for requests
   *
   * @param options - Start options (e.g., silent mode)
   * @throws {VeloxError} If server is already running or fails to start
   *
   * @example
   * ```typescript
   * await app.start();
   * console.log(`Server listening on ${app.address}`);
   * ```
   *
   * @example
   * ```typescript
   * // Start without banner
   * await app.start({ silent: true });
   * ```
   */
  async start(options: StartOptions = {}): Promise<void> {
    if (this._isRunning) {
      throw new VeloxError('Server is already running', 500, 'SERVER_ALREADY_RUNNING');
    }

    const startTime = performance.now();

    try {
      // Ensure Fastify is ready before listening (must be after plugin registration)
      await this._server.ready();

      // Start listening
      const address = await this._server.listen({
        port: this._config.port,
        host: this._config.host,
      });

      this._isRunning = true;
      this._address = address;

      // Print startup banner unless silent
      if (!options.silent) {
        printBanner(this._server, {
          address,
          env: process.env.NODE_ENV ?? 'development',
          startTime,
        });
      }
    } catch (error) {
      throw new VeloxError(
        `Failed to start server: ${error instanceof Error ? error.message : String(error)}`,
        500,
        'SERVER_START_ERROR'
      );
    }
  }

  /**
   * Stops the server gracefully
   *
   * - Stops accepting new requests
   * - Waits for in-flight requests to complete
   * - Executes shutdown handlers
   * - Closes the server
   *
   * @throws {VeloxError} If server is not running or fails to stop
   *
   * @example
   * ```typescript
   * await app.stop();
   * console.log('Server stopped');
   * ```
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      throw new VeloxError('Server is not running', 500, 'SERVER_NOT_RUNNING');
    }

    try {
      // Execute shutdown handlers
      await this._lifecycle.executeShutdownHandlers();

      // Clean up signal handlers to prevent memory leaks in tests
      this._lifecycle.cleanupSignalHandlers();

      // Close server
      await this._server.close();

      this._isRunning = false;
      this._address = null;

      this._server.log.info('Server stopped');
    } catch (error) {
      throw new VeloxError(
        `Failed to stop server: ${error instanceof Error ? error.message : String(error)}`,
        500,
        'SERVER_STOP_ERROR'
      );
    }
  }

  /**
   * Adds a handler to run before shutdown
   *
   * Shutdown handlers are called when the server stops, either via `stop()`
   * or when receiving SIGINT/SIGTERM signals. Use this to clean up resources
   * like database connections, file handles, etc.
   *
   * @param handler - Async function to call before shutdown
   *
   * @example
   * ```typescript
   * app.beforeShutdown(async () => {
   *   await database.disconnect();
   *   console.log('Database connection closed');
   * });
   * ```
   */
  beforeShutdown(handler: ShutdownHandler): void {
    this._lifecycle.addShutdownHandler(handler);
  }

  /**
   * Adds a shutdown handler
   *
   * @deprecated Use `beforeShutdown()` instead. This alias will be removed in v0.9.
   * @param handler - Async function to call during shutdown
   */
  onShutdown(handler: ShutdownHandler): void {
    this.beforeShutdown(handler);
  }
}

/**
 * Creates a new VeloxTS application instance
 *
 * This is the main entry point for creating a VeloxTS app.
 * The function is async to allow for async initialization.
 *
 * @param config - Application configuration
 * @returns Promise resolving to VeloxApp instance
 *
 * @example
 * ```typescript
 * const app = await veloxApp({
 *   port: 3030,
 *   host: '0.0.0.0',
 *   logger: true
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With default configuration
 * const app = await veloxApp();
 * await app.start(); // Listens on port 3030
 * ```
 *
 * @example
 * ```typescript
 * // With custom Fastify options
 * const app = await veloxApp({
 *   port: 4000,
 *   fastify: {
 *     requestTimeout: 30000,
 *     bodyLimit: 1048576 * 10, // 10MB
 *   }
 * });
 * ```
 */
export async function veloxApp(config: VeloxAppConfig = {}): Promise<VeloxApp> {
  const app = new VeloxApp(config);
  await app.initialize();
  return app;
}

/**
 * Creates a new VeloxTS application instance
 *
 * @deprecated Use `veloxApp()` instead. This alias will be removed in v0.9.
 * @param config - Application configuration
 * @returns Promise resolving to VeloxApp instance
 */
export const createVeloxApp = veloxApp;

/**
 * Short alias for veloxApp() - Laravel-style simplicity.
 *
 * @example
 * ```typescript
 * import { velox } from '@veloxts/velox';
 *
 * const app = await velox({ port: 3030 });
 * ```
 */
export const velox = veloxApp;
