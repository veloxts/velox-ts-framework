/**
 * Dependency Injection Container
 *
 * The VeloxTS DI container provides:
 * - Service registration with multiple provider types
 * - Automatic constructor injection via reflect-metadata
 * - Lifecycle management (singleton, transient, request-scoped)
 * - Circular dependency detection
 * - Integration with Fastify for request-scoped services
 *
 * @module di/container
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { VeloxError } from '../errors.js';
import {
  getConstructorTokens,
  getInjectableScope,
  getOptionalParams,
  isInjectable,
} from './decorators.js';
import type { NormalizedFactoryProvider, NormalizedProvider, Provider } from './providers.js';
import { normalizeProvider, validateProvider } from './providers.js';
import { Scope, ScopeManager } from './scope.js';
import type { ClassConstructor, InjectionToken } from './tokens.js';
import { getTokenName, isClassToken, validateToken } from './tokens.js';

// ============================================================================
// Container Options
// ============================================================================

/**
 * Options for creating a DI container
 */
export interface ContainerOptions {
  /**
   * Parent container for hierarchical injection
   *
   * If a service is not found in this container, it will be looked up
   * in the parent container.
   */
  parent?: Container;

  /**
   * Whether to allow auto-registration of classes
   *
   * If true, when resolving a class that isn't registered,
   * the container will attempt to instantiate it directly
   * (only for @Injectable classes).
   *
   * @default false
   */
  autoRegister?: boolean;
}

/**
 * Context for resolution, including request for request-scoped services
 */
export interface ResolutionContext {
  /**
   * The current Fastify request (for request-scoped services)
   */
  request?: FastifyRequest;
}

// ============================================================================
// Container Implementation
// ============================================================================

/**
 * Dependency Injection Container
 *
 * The central hub for service registration and resolution.
 * Manages service lifecycles and dependencies.
 *
 * @example
 * ```typescript
 * // Create a container
 * const container = new Container();
 *
 * // Register services
 * container.register({ provide: UserService, useClass: UserService });
 * container.register({
 *   provide: DATABASE,
 *   useFactory: (config) => createDb(config.dbUrl),
 *   inject: [ConfigService]
 * });
 *
 * // Resolve services
 * const userService = container.resolve(UserService);
 * const db = container.resolve(DATABASE);
 * ```
 */
export class Container {
  /**
   * Registered providers indexed by token
   */
  private readonly providers = new Map<unknown, NormalizedProvider>();

  /**
   * Manages singleton and request-scoped instance caches
   */
  private readonly scopeManager = new ScopeManager();

  /**
   * Parent container for hierarchical lookup
   */
  private readonly parent?: Container;

  /**
   * Whether to auto-register @Injectable classes
   */
  private readonly autoRegister: boolean;

  /**
   * Resolution stack for circular dependency detection
   */
  private readonly resolutionStack = new Set<unknown>();

  /**
   * Creates a new DI container
   *
   * @param options - Container configuration options
   *
   * @example
   * ```typescript
   * // Standalone container
   * const container = new Container();
   *
   * // Child container (inherits from parent)
   * const childContainer = new Container({ parent: container });
   *
   * // With auto-registration enabled
   * const autoContainer = new Container({ autoRegister: true });
   * ```
   */
  constructor(options: ContainerOptions = {}) {
    this.parent = options.parent;
    this.autoRegister = options.autoRegister ?? false;
  }

  // ==========================================================================
  // Registration
  // ==========================================================================

  /**
   * Registers a service provider
   *
   * @param provider - The provider configuration
   * @returns The container (for chaining)
   * @throws {VeloxError} If the provider is invalid
   *
   * @example
   * ```typescript
   * // Class provider
   * container.register({
   *   provide: UserService,
   *   useClass: UserService,
   *   scope: Scope.REQUEST
   * });
   *
   * // Factory provider
   * container.register({
   *   provide: DATABASE,
   *   useFactory: (config: ConfigService) => createDb(config.dbUrl),
   *   inject: [ConfigService]
   * });
   *
   * // Value provider
   * container.register({
   *   provide: CONFIG,
   *   useValue: { port: 3030, debug: true }
   * });
   *
   * // Existing/alias provider
   * container.register({
   *   provide: LOGGER,
   *   useExisting: ConsoleLogger
   * });
   * ```
   */
  register<T>(provider: Provider<T>): this {
    validateProvider(provider);

    const normalized = normalizeProvider(provider);
    this.providers.set(provider.provide, normalized);

    return this;
  }

  /**
   * Registers multiple providers at once
   *
   * @param providers - Array of provider configurations
   * @returns The container (for chaining)
   *
   * @example
   * ```typescript
   * container.registerMany([
   *   { provide: UserService, useClass: UserService },
   *   { provide: PostService, useClass: PostService },
   *   { provide: CONFIG, useValue: appConfig }
   * ]);
   * ```
   */
  registerMany(providers: Provider[]): this {
    for (const provider of providers) {
      this.register(provider);
    }
    return this;
  }

  /**
   * Checks if a token is registered
   *
   * @param token - The token to check
   * @returns true if the token is registered
   */
  isRegistered(token: InjectionToken): boolean {
    return this.providers.has(token) || (this.parent?.isRegistered(token) ?? false);
  }

  /**
   * Gets the provider for a token (without resolving)
   *
   * @param token - The token to get the provider for
   * @returns The normalized provider or undefined
   */
  getProvider<T>(token: InjectionToken<T>): NormalizedProvider<T> | undefined {
    const local = this.providers.get(token) as NormalizedProvider<T> | undefined;
    if (local) {
      return local;
    }

    return this.parent?.getProvider(token);
  }

  // ==========================================================================
  // Resolution
  // ==========================================================================

  /**
   * Resolves a service from the container
   *
   * @param token - The token to resolve
   * @param context - Optional resolution context (for request scope)
   * @returns The resolved service instance
   * @throws {VeloxError} If the service cannot be resolved
   *
   * @example
   * ```typescript
   * // Basic resolution
   * const userService = container.resolve(UserService);
   *
   * // With request context (for request-scoped services)
   * const userContext = container.resolve(UserContext, { request });
   * ```
   */
  resolve<T>(token: InjectionToken<T>, context?: ResolutionContext): T {
    validateToken(token);

    // Check for circular dependencies
    if (this.resolutionStack.has(token)) {
      const stack = [...this.resolutionStack].map((t) => getTokenName(t as InjectionToken));
      const current = getTokenName(token);
      throw new VeloxError(
        `Circular dependency detected: ${[...stack, current].join(' -> ')}`,
        500,
        'CIRCULAR_DEPENDENCY'
      );
    }

    // Get provider (local or from parent)
    let provider = this.getProvider(token);

    // Handle unregistered tokens
    if (!provider) {
      // Try auto-registration if enabled and token is a class
      if (this.autoRegister && isClassToken(token)) {
        provider = this.tryAutoRegister(token);
      }

      if (!provider) {
        throw new VeloxError(
          `No provider found for: ${getTokenName(token)}`,
          500,
          'SERVICE_NOT_FOUND'
        );
      }
    }

    // Resolve based on scope
    return this.resolveWithScope(token, provider, context);
  }

  /**
   * Resolves a service, returning undefined if not found
   *
   * @param token - The token to resolve
   * @param context - Optional resolution context
   * @returns The resolved service or undefined
   */
  resolveOptional<T>(token: InjectionToken<T>, context?: ResolutionContext): T | undefined {
    try {
      return this.resolve(token, context);
    } catch (error) {
      if (error instanceof VeloxError && error.code === 'SERVICE_NOT_FOUND') {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Resolves all services registered for a token
   *
   * Useful for multi-injection patterns where multiple implementations
   * are registered for the same token.
   *
   * @param token - The token to resolve
   * @param context - Optional resolution context
   * @returns Array of resolved service instances
   *
   * @example
   * ```typescript
   * // Register multiple validators
   * container.register({ provide: VALIDATOR, useClass: EmailValidator });
   * container.register({ provide: VALIDATOR, useClass: PhoneValidator });
   *
   * // Resolve all validators
   * const validators = container.resolveAll(VALIDATOR);
   * ```
   *
   * Note: Currently returns single instance. Multi-injection to be
   * implemented in v1.1 with a separate multi-provider registration API.
   */
  resolveAll<T>(token: InjectionToken<T>, context?: ResolutionContext): T[] {
    const instance = this.resolveOptional(token, context);
    return instance !== undefined ? [instance] : [];
  }

  /**
   * Resolves with scope management
   *
   * @internal
   */
  private resolveWithScope<T>(
    token: InjectionToken<T>,
    provider: NormalizedProvider<T>,
    context?: ResolutionContext
  ): T {
    switch (provider.scope) {
      case Scope.SINGLETON: {
        // Check cache first
        if (this.scopeManager.hasSingleton(token)) {
          return this.scopeManager.getSingletonOrThrow<T>(token);
        }

        // Create and cache
        const instance = this.createInstance(token, provider, context);
        this.scopeManager.setSingleton(token, instance);
        return instance;
      }

      case Scope.TRANSIENT: {
        // Always create new instance
        return this.createInstance(token, provider, context);
      }

      case Scope.REQUEST: {
        // Validate and get request context
        const request = this.scopeManager.ensureRequestScope(context?.request);

        // Check request cache first
        if (this.scopeManager.hasRequestScoped(token, request)) {
          return this.scopeManager.getRequestScopedOrThrow<T>(token, request);
        }

        // Create and cache in request scope
        const instance = this.createInstance(token, provider, context);
        this.scopeManager.setRequestScoped(token, instance, request);
        return instance;
      }

      default: {
        throw new VeloxError(`Unknown scope: ${provider.scope}`, 500, 'SCOPE_MISMATCH');
      }
    }
  }

  /**
   * Creates an instance based on provider type
   *
   * @internal
   */
  private createInstance<T>(
    token: InjectionToken<T>,
    provider: NormalizedProvider<T>,
    context?: ResolutionContext
  ): T {
    // Track resolution for circular dependency detection
    this.resolutionStack.add(token);

    try {
      switch (provider.type) {
        case 'class':
          return this.instantiateClass(provider.implementation.class, context);

        case 'factory':
          return this.invokeFactory(provider, context);

        case 'value':
          return provider.implementation.value;

        case 'existing':
          return this.resolve(provider.implementation.existing, context);

        default: {
          // This should never happen - use never type for exhaustive check
          const exhaustiveCheck: never = provider;
          throw new VeloxError(
            `Unknown provider type: ${(exhaustiveCheck as { type: string }).type}`,
            500,
            'INVALID_PROVIDER'
          );
        }
      }
    } finally {
      this.resolutionStack.delete(token);
    }
  }

  /**
   * Instantiates a class with automatic dependency injection
   *
   * @internal
   */
  private instantiateClass<T>(cls: ClassConstructor<T>, context?: ResolutionContext): T {
    // Get constructor dependency tokens
    const tokens = getConstructorTokens(cls);
    const optionalParams = getOptionalParams(cls);

    // Resolve all dependencies
    const dependencies: unknown[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const isOptional = optionalParams.has(i);

      try {
        // Handle Object type (unresolved interface)
        if (token === Object) {
          if (isOptional) {
            dependencies.push(undefined);
            continue;
          }
          throw new VeloxError(
            `Cannot resolve dependency at index ${i} for ${cls.name}: ` +
              'Type resolved to Object. Use @Inject() decorator for interfaces.',
            500,
            'MISSING_INJECTABLE_DECORATOR'
          );
        }

        const dependency = isOptional
          ? this.resolveOptional(token as InjectionToken, context)
          : this.resolve(token as InjectionToken, context);

        dependencies.push(dependency);
      } catch (error) {
        if (isOptional && error instanceof VeloxError && error.code === 'SERVICE_NOT_FOUND') {
          dependencies.push(undefined);
        } else {
          throw error;
        }
      }
    }

    // Instantiate the class
    // Note: We need to spread the dependencies array into the constructor
    // TypeScript doesn't know the exact number of parameters, so we use the
    // constructor with a spread of unknown[]
    return new (cls as new (...args: unknown[]) => T)(...dependencies);
  }

  /**
   * Invokes a factory function with dependencies
   *
   * @internal
   */
  private invokeFactory<T>(provider: NormalizedFactoryProvider<T>, context?: ResolutionContext): T {
    const factory = provider.implementation.factory;
    const injectTokens = provider.implementation.inject ?? [];

    // Resolve factory dependencies
    const dependencies: unknown[] = injectTokens.map((token) => this.resolve(token, context));

    // Invoke factory
    const result = (factory as (...args: unknown[]) => T | Promise<T>)(...dependencies);

    // Handle async factories (should be avoided in sync resolution)
    if (result instanceof Promise) {
      throw new VeloxError(
        'Async factory returned from sync resolve(). Use resolveAsync() for async factories.',
        500,
        'INVALID_PROVIDER'
      );
    }

    return result;
  }

  /**
   * Tries to auto-register a class if it's injectable
   *
   * @internal
   */
  private tryAutoRegister<T>(cls: ClassConstructor<T>): NormalizedProvider<T> | undefined {
    if (!isInjectable(cls)) {
      return undefined;
    }

    const scope = getInjectableScope(cls);

    const provider: Provider<T> = {
      provide: cls,
      useClass: cls,
      scope,
    };

    this.register(provider);
    return this.getProvider(cls);
  }

  // ==========================================================================
  // Async Resolution
  // ==========================================================================

  /**
   * Resolves a service asynchronously
   *
   * Use this method when your providers include async factories.
   *
   * @param token - The token to resolve
   * @param context - Optional resolution context
   * @returns Promise resolving to the service instance
   *
   * @example
   * ```typescript
   * container.register({
   *   provide: DATABASE,
   *   useFactory: async (config) => {
   *     const client = createClient(config.dbUrl);
   *     await client.connect();
   *     return client;
   *   },
   *   inject: [ConfigService]
   * });
   *
   * const db = await container.resolveAsync(DATABASE);
   * ```
   */
  async resolveAsync<T>(token: InjectionToken<T>, context?: ResolutionContext): Promise<T> {
    validateToken(token);

    // Check for circular dependencies
    if (this.resolutionStack.has(token)) {
      const stack = [...this.resolutionStack].map((t) => getTokenName(t as InjectionToken));
      const current = getTokenName(token);
      throw new VeloxError(
        `Circular dependency detected: ${[...stack, current].join(' -> ')}`,
        500,
        'CIRCULAR_DEPENDENCY'
      );
    }

    // Get provider
    let provider = this.getProvider(token);

    if (!provider) {
      if (this.autoRegister && isClassToken(token)) {
        provider = this.tryAutoRegister(token);
      }

      if (!provider) {
        throw new VeloxError(
          `No provider found for: ${getTokenName(token)}`,
          500,
          'SERVICE_NOT_FOUND'
        );
      }
    }

    return this.resolveWithScopeAsync(token, provider, context);
  }

  /**
   * Async scope resolution
   *
   * @internal
   */
  private async resolveWithScopeAsync<T>(
    token: InjectionToken<T>,
    provider: NormalizedProvider<T>,
    context?: ResolutionContext
  ): Promise<T> {
    switch (provider.scope) {
      case Scope.SINGLETON: {
        if (this.scopeManager.hasSingleton(token)) {
          return this.scopeManager.getSingletonOrThrow<T>(token);
        }

        const instance = await this.createInstanceAsync(token, provider, context);
        this.scopeManager.setSingleton(token, instance);
        return instance;
      }

      case Scope.TRANSIENT: {
        return this.createInstanceAsync(token, provider, context);
      }

      case Scope.REQUEST: {
        // Validate and get request context
        const request = this.scopeManager.ensureRequestScope(context?.request);

        if (this.scopeManager.hasRequestScoped(token, request)) {
          return this.scopeManager.getRequestScopedOrThrow<T>(token, request);
        }

        const instance = await this.createInstanceAsync(token, provider, context);
        this.scopeManager.setRequestScoped(token, instance, request);
        return instance;
      }

      default: {
        throw new VeloxError(`Unknown scope: ${provider.scope}`, 500, 'SCOPE_MISMATCH');
      }
    }
  }

  /**
   * Async instance creation
   *
   * @internal
   */
  private async createInstanceAsync<T>(
    token: InjectionToken<T>,
    provider: NormalizedProvider<T>,
    context?: ResolutionContext
  ): Promise<T> {
    this.resolutionStack.add(token);

    try {
      switch (provider.type) {
        case 'class':
          return await this.instantiateClassAsync(provider.implementation.class, context);

        case 'factory':
          return await this.invokeFactoryAsync(provider, context);

        case 'value':
          return provider.implementation.value;

        case 'existing':
          return await this.resolveAsync(provider.implementation.existing, context);

        default: {
          // This should never happen - use never type for exhaustive check
          const exhaustiveCheck: never = provider;
          throw new VeloxError(
            `Unknown provider type: ${(exhaustiveCheck as { type: string }).type}`,
            500,
            'INVALID_PROVIDER'
          );
        }
      }
    } finally {
      this.resolutionStack.delete(token);
    }
  }

  /**
   * Async class instantiation
   *
   * @internal
   */
  private async instantiateClassAsync<T>(
    cls: ClassConstructor<T>,
    context?: ResolutionContext
  ): Promise<T> {
    const tokens = getConstructorTokens(cls);
    const optionalParams = getOptionalParams(cls);

    const dependencies: unknown[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const isOptional = optionalParams.has(i);

      try {
        if (token === Object) {
          if (isOptional) {
            dependencies.push(undefined);
            continue;
          }
          throw new VeloxError(
            `Cannot resolve dependency at index ${i} for ${cls.name}: ` +
              'Type resolved to Object. Use @Inject() decorator for interfaces.',
            500,
            'MISSING_INJECTABLE_DECORATOR'
          );
        }

        const dependency = isOptional
          ? await this.resolveAsync(token as InjectionToken, context).catch(() => undefined)
          : await this.resolveAsync(token as InjectionToken, context);

        dependencies.push(dependency);
      } catch (error) {
        if (isOptional) {
          dependencies.push(undefined);
        } else {
          throw error;
        }
      }
    }

    return new (cls as new (...args: unknown[]) => T)(...dependencies);
  }

  /**
   * Async factory invocation
   *
   * @internal
   */
  private async invokeFactoryAsync<T>(
    provider: NormalizedFactoryProvider<T>,
    context?: ResolutionContext
  ): Promise<T> {
    const factory = provider.implementation.factory;
    const injectTokens = provider.implementation.inject ?? [];

    const dependencies = await Promise.all(
      injectTokens.map((token) => this.resolveAsync(token, context))
    );

    const result = (factory as (...args: unknown[]) => T | Promise<T>)(...dependencies);
    return result instanceof Promise ? result : result;
  }

  // ==========================================================================
  // Fastify Integration
  // ==========================================================================

  /**
   * Attaches the container to a Fastify server
   *
   * Sets up the request lifecycle hooks needed for request-scoped services.
   * Must be called before resolving request-scoped services.
   *
   * @param server - Fastify server instance
   * @returns The container (for chaining)
   *
   * @example
   * ```typescript
   * const app = await createVeloxApp();
   * container.attachToFastify(app.server);
   * ```
   */
  attachToFastify(server: FastifyInstance): this {
    this.scopeManager.attachToFastify(server);
    return this;
  }

  /**
   * Creates a resolution context from a Fastify request
   *
   * @param request - The Fastify request
   * @returns Resolution context for request-scoped services
   */
  static createContext(request: FastifyRequest): ResolutionContext {
    return { request };
  }

  // ==========================================================================
  // Container Management
  // ==========================================================================

  /**
   * Creates a child container
   *
   * Child containers inherit from this container but can override registrations.
   * Useful for testing or creating scoped containers.
   *
   * @param options - Options for the child container
   * @returns New child container
   *
   * @example
   * ```typescript
   * const childContainer = container.createChild();
   *
   * // Override a service for testing
   * childContainer.register({
   *   provide: UserRepository,
   *   useClass: MockUserRepository
   * });
   * ```
   */
  createChild(options: Omit<ContainerOptions, 'parent'> = {}): Container {
    return new Container({ ...options, parent: this });
  }

  /**
   * Clears all singleton instances
   *
   * Useful for testing or application shutdown.
   * Does not clear registrations.
   */
  clearInstances(): void {
    this.scopeManager.clearSingletons();
  }

  /**
   * Clears all registrations and instances
   *
   * @internal
   */
  reset(): void {
    this.providers.clear();
    this.scopeManager.reset();
    this.resolutionStack.clear();
  }

  /**
   * Gets debug information about the container
   *
   * @returns Object with container statistics and registered providers
   */
  getDebugInfo(): {
    providerCount: number;
    providers: string[];
    hasParent: boolean;
    autoRegister: boolean;
  } {
    return {
      providerCount: this.providers.size,
      providers: [...this.providers.values()].map((p) => {
        const tokenName = getTokenName(p.provide);
        return `${p.type}(${tokenName}, ${p.scope})`;
      }),
      hasParent: this.parent !== undefined,
      autoRegister: this.autoRegister,
    };
  }
}

// ============================================================================
// Global Container
// ============================================================================

/**
 * Default global container instance
 *
 * For convenience, VeloxTS provides a default container.
 * You can also create your own containers for testing or isolation.
 *
 * @example
 * ```typescript
 * import { container } from '@veloxts/core';
 *
 * container.register({
 *   provide: UserService,
 *   useClass: UserService
 * });
 *
 * const userService = container.resolve(UserService);
 * ```
 */
export const container = new Container();

// ============================================================================
// Container Factory
// ============================================================================

/**
 * Creates a new DI container
 *
 * @deprecated Use the `container` singleton or `new Container(options)` directly.
 *
 * @param options - Container configuration options
 * @returns New container instance
 *
 * @example
 * ```typescript
 * // Preferred: Use the singleton
 * import { container } from '@veloxts/core';
 *
 * // Or create new instance directly
 * const appContainer = new Container({ autoRegister: true });
 * ```
 */
export function createContainer(options?: ContainerOptions): Container {
  return new Container(options);
}
