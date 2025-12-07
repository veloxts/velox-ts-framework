/**
 * Provider types and registration interfaces for dependency injection
 *
 * Providers define how services are created and configured.
 * VeloxTS supports four provider types:
 * - Class providers: Instantiate a class
 * - Factory providers: Use a factory function
 * - Value providers: Use an existing value
 * - Existing providers: Alias another token
 *
 * @module di/providers
 */

import { VeloxError } from '../errors.js';
import { getDefaultScope, isValidScope, Scope } from './scope.js';
import type { ClassConstructor, InjectionToken } from './tokens.js';
import { getTokenName, validateToken } from './tokens.js';

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Base provider interface
 *
 * All providers must specify the token they provide
 * and optionally their lifecycle scope.
 *
 * @template T - The type of service being provided
 */
interface BaseProvider<T = unknown> {
  /**
   * The token that identifies this service
   */
  provide: InjectionToken<T>;

  /**
   * The lifecycle scope for this service
   * @default Scope.SINGLETON
   */
  scope?: Scope;
}

/**
 * Class provider
 *
 * Creates instances by calling `new` on the specified class.
 * Constructor dependencies are automatically injected.
 *
 * @template T - The type of service being provided
 *
 * @example
 * ```typescript
 * container.register({
 *   provide: UserService,
 *   useClass: UserService,
 *   scope: Scope.REQUEST
 * });
 *
 * // Or with a different implementation
 * container.register({
 *   provide: IUserRepository,
 *   useClass: PrismaUserRepository
 * });
 * ```
 */
export interface ClassProvider<T = unknown> extends BaseProvider<T> {
  /**
   * The class to instantiate
   */
  useClass: ClassConstructor<T>;
}

/**
 * Factory provider
 *
 * Creates instances using a factory function.
 * Dependencies can be injected into the factory via the `inject` array.
 *
 * @template T - The type of service being provided
 *
 * @example
 * ```typescript
 * container.register({
 *   provide: DATABASE,
 *   useFactory: (config: ConfigService) => {
 *     return createDatabaseClient(config.databaseUrl);
 *   },
 *   inject: [ConfigService],
 *   scope: Scope.SINGLETON
 * });
 * ```
 */
export interface FactoryProvider<T = unknown> extends BaseProvider<T> {
  /**
   * The factory function that creates the service
   *
   * Receives resolved dependencies in order matching the `inject` array.
   */
  useFactory: (...args: never[]) => T | Promise<T>;

  /**
   * Tokens for dependencies to inject into the factory
   *
   * Dependencies are resolved and passed to the factory in order.
   */
  inject?: InjectionToken[];
}

/**
 * Value provider
 *
 * Uses an existing value directly without any instantiation.
 * Useful for configuration objects, constants, or pre-created instances.
 *
 * @template T - The type of service being provided
 *
 * @example
 * ```typescript
 * container.register({
 *   provide: CONFIG,
 *   useValue: {
 *     port: 3210,
 *     host: 'localhost',
 *     debug: true
 *   }
 * });
 * ```
 */
export interface ValueProvider<T = unknown> extends BaseProvider<T> {
  /**
   * The value to use as the service instance
   */
  useValue: T;
}

/**
 * Existing provider (alias)
 *
 * Aliases one token to another, allowing multiple tokens
 * to resolve to the same service.
 *
 * @template T - The type of service being provided
 *
 * @example
 * ```typescript
 * // Register the concrete implementation
 * container.register({
 *   provide: ConsoleLogger,
 *   useClass: ConsoleLogger
 * });
 *
 * // Create an alias using the interface token
 * container.register({
 *   provide: LOGGER,
 *   useExisting: ConsoleLogger
 * });
 *
 * // Both resolve to the same instance
 * const logger1 = container.resolve(LOGGER);
 * const logger2 = container.resolve(ConsoleLogger);
 * // logger1 === logger2
 * ```
 */
export interface ExistingProvider<T = unknown> extends BaseProvider<T> {
  /**
   * The token to alias to
   *
   * Resolving the `provide` token will resolve this token instead.
   */
  useExisting: InjectionToken<T>;
}

/**
 * Union of all provider types
 */
export type Provider<T = unknown> =
  | ClassProvider<T>
  | FactoryProvider<T>
  | ValueProvider<T>
  | ExistingProvider<T>;

// ============================================================================
// Provider Type Guards
// ============================================================================

/**
 * Type guard for class providers
 */
export function isClassProvider<T>(provider: Provider<T>): provider is ClassProvider<T> {
  return 'useClass' in provider && typeof provider.useClass === 'function';
}

/**
 * Type guard for factory providers
 */
export function isFactoryProvider<T>(provider: Provider<T>): provider is FactoryProvider<T> {
  return 'useFactory' in provider && typeof provider.useFactory === 'function';
}

/**
 * Type guard for value providers
 */
export function isValueProvider<T>(provider: Provider<T>): provider is ValueProvider<T> {
  return 'useValue' in provider;
}

/**
 * Type guard for existing/alias providers
 */
export function isExistingProvider<T>(provider: Provider<T>): provider is ExistingProvider<T> {
  return 'useExisting' in provider;
}

// ============================================================================
// Provider Validation
// ============================================================================

/**
 * Validates a provider configuration
 *
 * @param provider - The provider to validate
 * @throws {VeloxError} If the provider is invalid
 */
export function validateProvider(provider: unknown): asserts provider is Provider {
  // Check provider is an object
  if (typeof provider !== 'object' || provider === null) {
    throw new VeloxError('Provider must be an object', 500, 'INVALID_PROVIDER');
  }

  // Check 'provide' token exists
  if (!('provide' in provider)) {
    throw new VeloxError('Provider must have a "provide" token', 500, 'INVALID_PROVIDER');
  }

  // Validate the token
  validateToken((provider as { provide: unknown }).provide);

  const typedProvider = provider as Record<string, unknown>;

  // Check that exactly one of the provider type properties exists
  const providerTypes = ['useClass', 'useFactory', 'useValue', 'useExisting'];
  const definedTypes = providerTypes.filter((type) => type in typedProvider);

  if (definedTypes.length === 0) {
    throw new VeloxError(
      'Provider must specify one of: useClass, useFactory, useValue, or useExisting',
      500,
      'INVALID_PROVIDER'
    );
  }

  if (definedTypes.length > 1) {
    throw new VeloxError(
      `Provider cannot have multiple types. Found: ${definedTypes.join(', ')}`,
      500,
      'INVALID_PROVIDER'
    );
  }

  // Validate scope if provided
  if ('scope' in typedProvider && typedProvider.scope !== undefined) {
    if (!isValidScope(typedProvider.scope)) {
      throw new VeloxError(
        `Invalid scope: ${String(typedProvider.scope)}. Must be one of: singleton, transient, request`,
        500,
        'INVALID_PROVIDER'
      );
    }
  }

  // Validate specific provider types
  if ('useClass' in typedProvider) {
    if (typeof typedProvider.useClass !== 'function') {
      throw new VeloxError('useClass must be a class constructor', 500, 'INVALID_PROVIDER');
    }
  }

  if ('useFactory' in typedProvider) {
    if (typeof typedProvider.useFactory !== 'function') {
      throw new VeloxError('useFactory must be a function', 500, 'INVALID_PROVIDER');
    }

    if ('inject' in typedProvider && typedProvider.inject !== undefined) {
      if (!Array.isArray(typedProvider.inject)) {
        throw new VeloxError(
          'Factory inject must be an array of injection tokens',
          500,
          'INVALID_PROVIDER'
        );
      }

      // Validate each inject token
      for (const token of typedProvider.inject) {
        validateToken(token);
      }
    }
  }

  if ('useExisting' in typedProvider) {
    validateToken(typedProvider.useExisting);
  }
}

// ============================================================================
// Provider Normalization
// ============================================================================

/**
 * Normalized class provider
 * @internal
 */
interface NormalizedClassProvider<T = unknown> {
  provide: InjectionToken<T>;
  scope: Scope;
  type: 'class';
  implementation: {
    class: ClassConstructor<T>;
  };
}

/**
 * Normalized factory provider
 * @internal
 */
export interface NormalizedFactoryProvider<T = unknown> {
  provide: InjectionToken<T>;
  scope: Scope;
  type: 'factory';
  implementation: {
    factory: (...args: never[]) => T | Promise<T>;
    inject?: InjectionToken[];
  };
}

/**
 * Normalized value provider
 * @internal
 */
interface NormalizedValueProvider<T = unknown> {
  provide: InjectionToken<T>;
  scope: Scope;
  type: 'value';
  implementation: {
    value: T;
  };
}

/**
 * Normalized existing/alias provider
 * @internal
 */
interface NormalizedExistingProvider<T = unknown> {
  provide: InjectionToken<T>;
  scope: Scope;
  type: 'existing';
  implementation: {
    existing: InjectionToken<T>;
  };
}

/**
 * Normalized provider with all optional fields filled in
 *
 * Uses discriminated union based on 'type' field for proper type narrowing.
 *
 * @internal
 */
export type NormalizedProvider<T = unknown> =
  | NormalizedClassProvider<T>
  | NormalizedFactoryProvider<T>
  | NormalizedValueProvider<T>
  | NormalizedExistingProvider<T>;

/**
 * Normalizes a provider to a consistent internal format
 *
 * @param provider - The provider to normalize
 * @returns The normalized provider
 *
 * @internal
 */
export function normalizeProvider<T>(provider: Provider<T>): NormalizedProvider<T> {
  const scope = provider.scope ?? getDefaultScope();

  if (isClassProvider(provider)) {
    return {
      provide: provider.provide,
      scope,
      type: 'class',
      implementation: {
        class: provider.useClass,
      },
    };
  }

  if (isFactoryProvider(provider)) {
    return {
      provide: provider.provide,
      scope,
      type: 'factory',
      implementation: {
        factory: provider.useFactory,
        inject: provider.inject,
      },
    };
  }

  if (isValueProvider(provider)) {
    // Value providers are always effectively singleton since they use the same value
    return {
      provide: provider.provide,
      scope: Scope.SINGLETON,
      type: 'value',
      implementation: {
        value: provider.useValue,
      },
    };
  }

  if (isExistingProvider(provider)) {
    return {
      provide: provider.provide,
      scope, // Inherit scope from the aliased provider at resolution time
      type: 'existing',
      implementation: {
        existing: provider.useExisting,
      },
    };
  }

  // This should never happen due to validation, but TypeScript needs it
  throw new VeloxError('Unknown provider type', 500, 'INVALID_PROVIDER');
}

// ============================================================================
// Convenience Provider Builders
// ============================================================================

/**
 * Creates a class provider with type inference
 *
 * @param cls - The class to provide
 * @param scope - The lifecycle scope
 * @returns A class provider configuration
 *
 * @example
 * ```typescript
 * container.register(asClass(UserService, Scope.REQUEST));
 * ```
 */
export function asClass<T>(
  cls: ClassConstructor<T>,
  scope: Scope = Scope.SINGLETON
): ClassProvider<T> {
  return {
    provide: cls,
    useClass: cls,
    scope,
  };
}

/**
 * Creates a factory provider with type inference
 *
 * @param token - The token to provide
 * @param factory - The factory function
 * @param options - Factory options (inject, scope)
 * @returns A factory provider configuration
 *
 * @example
 * ```typescript
 * container.register(asFactory(
 *   DATABASE,
 *   (config: ConfigService) => createDb(config.dbUrl),
 *   { inject: [ConfigService] }
 * ));
 * ```
 */
export function asFactory<T>(
  token: InjectionToken<T>,
  factory: (...args: never[]) => T | Promise<T>,
  options: { inject?: InjectionToken[]; scope?: Scope } = {}
): FactoryProvider<T> {
  return {
    provide: token,
    useFactory: factory,
    inject: options.inject,
    scope: options.scope ?? Scope.SINGLETON,
  };
}

/**
 * Creates a value provider with type inference
 *
 * @param token - The token to provide
 * @param value - The value to use
 * @returns A value provider configuration
 *
 * @example
 * ```typescript
 * container.register(asValue(CONFIG, { port: 3210 }));
 * ```
 */
export function asValue<T>(token: InjectionToken<T>, value: T): ValueProvider<T> {
  return {
    provide: token,
    useValue: value,
  };
}

/**
 * Creates an existing/alias provider with type inference
 *
 * @param token - The token to provide (alias)
 * @param existing - The token to alias to
 * @returns An existing provider configuration
 *
 * @example
 * ```typescript
 * container.register(asExisting(LOGGER, ConsoleLogger));
 * ```
 */
export function asExisting<T>(
  token: InjectionToken<T>,
  existing: InjectionToken<T>
): ExistingProvider<T> {
  return {
    provide: token,
    useExisting: existing,
  };
}

// ============================================================================
// Succinct Scope Helpers
// ============================================================================

/**
 * Creates a singleton class provider
 *
 * Singleton services are instantiated once and shared across all requests.
 * This is the default scope and the most common pattern.
 *
 * @param cls - The class to provide as a singleton
 * @returns A class provider configured as singleton
 *
 * @example
 * ```typescript
 * container.register(singleton(ConfigService));
 * container.register(singleton(DatabasePool));
 * ```
 */
export function singleton<T>(cls: ClassConstructor<T>): ClassProvider<T> {
  return {
    provide: cls,
    useClass: cls,
    scope: Scope.SINGLETON,
  };
}

/**
 * Creates a request-scoped class provider
 *
 * Request-scoped services are instantiated once per HTTP request.
 * Ideal for services that need request-specific state.
 *
 * @param cls - The class to provide with request scope
 * @returns A class provider configured as request-scoped
 *
 * @example
 * ```typescript
 * container.register(scoped(RequestContext));
 * container.register(scoped(UserSession));
 * ```
 */
export function scoped<T>(cls: ClassConstructor<T>): ClassProvider<T> {
  return {
    provide: cls,
    useClass: cls,
    scope: Scope.REQUEST,
  };
}

/**
 * Creates a transient class provider
 *
 * Transient services are instantiated every time they are resolved.
 * Useful for stateful objects that should not be shared.
 *
 * @param cls - The class to provide as transient
 * @returns A class provider configured as transient
 *
 * @example
 * ```typescript
 * container.register(transient(EmailBuilder));
 * container.register(transient(RequestId));
 * ```
 */
export function transient<T>(cls: ClassConstructor<T>): ClassProvider<T> {
  return {
    provide: cls,
    useClass: cls,
    scope: Scope.TRANSIENT,
  };
}

/**
 * Creates a value provider (convenience alias)
 *
 * @param token - The token to provide
 * @param val - The value to use
 * @returns A value provider configuration
 *
 * @example
 * ```typescript
 * container.register(value(CONFIG, { port: 3210 }));
 * ```
 */
export function value<T>(token: InjectionToken<T>, val: T): ValueProvider<T> {
  return {
    provide: token,
    useValue: val,
  };
}

/**
 * Creates a factory provider (convenience alias)
 *
 * @param token - The token to provide
 * @param factoryFn - The factory function
 * @param deps - Dependencies to inject into the factory
 * @returns A factory provider configuration
 *
 * @example
 * ```typescript
 * container.register(factory(DATABASE, createDb, [ConfigService]));
 * ```
 */
export function factory<T>(
  token: InjectionToken<T>,
  factoryFn: (...args: never[]) => T | Promise<T>,
  deps?: InjectionToken[]
): FactoryProvider<T> {
  return {
    provide: token,
    useFactory: factoryFn,
    inject: deps,
    scope: Scope.SINGLETON,
  };
}

// ============================================================================
// Provider Description (for debugging)
// ============================================================================

/**
 * Gets a human-readable description of a provider
 *
 * @param provider - The provider to describe
 * @returns A string description
 *
 * @internal
 */
export function describeProvider(provider: Provider): string {
  const tokenName = getTokenName(provider.provide);
  const scope = provider.scope ?? 'singleton';

  if (isClassProvider(provider)) {
    const className = provider.useClass.name || 'AnonymousClass';
    return `ClassProvider(${tokenName} => ${className}, ${scope})`;
  }

  if (isFactoryProvider(provider)) {
    const deps = provider.inject?.map(getTokenName).join(', ') ?? 'none';
    return `FactoryProvider(${tokenName}, deps=[${deps}], ${scope})`;
  }

  if (isValueProvider(provider)) {
    return `ValueProvider(${tokenName})`;
  }

  if (isExistingProvider(provider)) {
    const existing = getTokenName(provider.useExisting);
    return `ExistingProvider(${tokenName} => ${existing})`;
  }

  return `Provider(${tokenName})`;
}
