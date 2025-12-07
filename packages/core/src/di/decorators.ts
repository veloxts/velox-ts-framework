/**
 * Decorators for dependency injection
 *
 * VeloxTS uses TypeScript decorators with reflect-metadata for automatic
 * constructor injection. These decorators provide metadata that the
 * container uses to resolve dependencies.
 *
 * IMPORTANT: Requires `experimentalDecorators` and `emitDecoratorMetadata`
 * in tsconfig.json, and `import 'reflect-metadata'` at your app's entry point.
 *
 * @module di/decorators
 */

import 'reflect-metadata';

import { Scope } from './scope.js';
import type { InjectionToken } from './tokens.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Type representing a class constructor for decorator metadata operations
 *
 * This type is used throughout the DI decorator system to represent classes
 * that can have metadata attached via reflect-metadata. It uses a permissive
 * signature compatible with any class constructor.
 *
 * Note: This differs from ClassConstructor in tokens.ts which uses `never[]`
 * for strict type inference. This type uses `never` for args to remain
 * compatible with ClassConstructor while accepting any constructor.
 *
 * @typeParam T - The instance type that the constructor creates
 */
export type Constructor<T = unknown> = abstract new (...args: never) => T;

// ============================================================================
// Metadata Keys
// ============================================================================

/**
 * Metadata key for storing whether a class is injectable
 */
export const INJECTABLE_METADATA_KEY = Symbol('velox:injectable');

/**
 * Metadata key for storing the scope of an injectable class
 */
export const SCOPE_METADATA_KEY = Symbol('velox:scope');

/**
 * Metadata key for storing parameter injection tokens
 */
export const INJECT_METADATA_KEY = Symbol('velox:inject');

/**
 * Metadata key for storing optional parameter flags
 */
export const OPTIONAL_METADATA_KEY = Symbol('velox:optional');

/**
 * Built-in key used by TypeScript's emitDecoratorMetadata
 */
export const DESIGN_PARAMTYPES_KEY = 'design:paramtypes';

// ============================================================================
// Injectable Decorator
// ============================================================================

/**
 * Options for the @Injectable decorator
 */
export interface InjectableOptions {
  /**
   * The lifecycle scope for this service
   * @default Scope.SINGLETON
   */
  scope?: Scope;
}

/**
 * Marks a class as injectable
 *
 * Classes decorated with @Injectable can be:
 * - Automatically instantiated by the container
 * - Have their constructor dependencies resolved automatically
 * - Registered with a specific lifecycle scope
 *
 * @param options - Injectable configuration options
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * // Basic usage with default singleton scope
 * @Injectable()
 * class UserService {
 *   constructor(private db: DatabaseClient) {}
 * }
 *
 * // With request scope
 * @Injectable({ scope: Scope.REQUEST })
 * class UserContext {
 *   constructor(private request: FastifyRequest) {}
 * }
 *
 * // With transient scope
 * @Injectable({ scope: Scope.TRANSIENT })
 * class RequestIdGenerator {
 *   readonly id = crypto.randomUUID();
 * }
 * ```
 */
export function Injectable(options: InjectableOptions = {}): ClassDecorator {
  // biome-ignore lint/complexity/noBannedTypes: ClassDecorator requires Function type per TypeScript lib.es5.d.ts
  return function injectableDecorator<T extends Function>(target: T): T {
    // Mark the class as injectable
    Reflect.defineMetadata(INJECTABLE_METADATA_KEY, true, target);

    // Store the scope (default to SINGLETON)
    Reflect.defineMetadata(SCOPE_METADATA_KEY, options.scope ?? Scope.SINGLETON, target);

    return target;
  };
}

// ============================================================================
// Inject Decorator
// ============================================================================

/**
 * Explicitly specifies the injection token for a constructor parameter
 *
 * Use this decorator when:
 * - Injecting by a string or symbol token instead of class
 * - Injecting an interface (TypeScript interfaces are erased at runtime)
 * - The automatic type resolution doesn't work correctly
 *
 * @param token - The injection token to use
 * @returns Parameter decorator
 *
 * @example
 * ```typescript
 * const DATABASE = createStringToken<DatabaseClient>('DATABASE');
 * const LOGGER = createSymbolToken<Logger>('LOGGER');
 *
 * @Injectable()
 * class UserService {
 *   constructor(
 *     @Inject(DATABASE) private db: DatabaseClient,
 *     @Inject(LOGGER) private logger: Logger,
 *     private config: ConfigService, // Auto-injected by class token
 *   ) {}
 * }
 * ```
 */
export function Inject(token: InjectionToken): ParameterDecorator {
  return function injectDecorator(
    // biome-ignore lint/complexity/noBannedTypes: ParameterDecorator requires Object type per TypeScript lib.es5.d.ts
    target: Object,
    _propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    // Get existing inject metadata or create new array
    const existingTokens: Map<number, InjectionToken> =
      Reflect.getMetadata(INJECT_METADATA_KEY, target) ?? new Map<number, InjectionToken>();

    // Store the token for this parameter index
    existingTokens.set(parameterIndex, token);

    // Save the metadata
    Reflect.defineMetadata(INJECT_METADATA_KEY, existingTokens, target);
  };
}

// ============================================================================
// Optional Decorator
// ============================================================================

/**
 * Marks a constructor parameter as optional
 *
 * When a dependency is marked as optional and cannot be resolved,
 * `undefined` is injected instead of throwing an error.
 *
 * @returns Parameter decorator
 *
 * @example
 * ```typescript
 * @Injectable()
 * class NotificationService {
 *   constructor(
 *     @Optional() private emailService?: EmailService,
 *     @Optional() @Inject(SMS_SERVICE) private smsService?: SmsService,
 *   ) {}
 *
 *   notify(message: string) {
 *     // Gracefully handle missing services
 *     this.emailService?.send(message);
 *     this.smsService?.send(message);
 *   }
 * }
 * ```
 */
export function Optional(): ParameterDecorator {
  return function optionalDecorator(
    // biome-ignore lint/complexity/noBannedTypes: ParameterDecorator requires Object type per TypeScript lib.es5.d.ts
    target: Object,
    _propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    // Get existing optional flags or create new set
    const optionalParams: Set<number> =
      Reflect.getMetadata(OPTIONAL_METADATA_KEY, target) ?? new Set<number>();

    // Mark this parameter as optional
    optionalParams.add(parameterIndex);

    // Save the metadata
    Reflect.defineMetadata(OPTIONAL_METADATA_KEY, optionalParams, target);
  };
}

// ============================================================================
// Metadata Readers
// ============================================================================

/**
 * Checks if a class is marked as injectable
 *
 * @param target - The class to check
 * @returns true if the class has the @Injectable decorator
 */
export function isInjectable(target: Constructor): boolean {
  return Reflect.getMetadata(INJECTABLE_METADATA_KEY, target) === true;
}

/**
 * Gets the scope of an injectable class
 *
 * @param target - The class to check
 * @returns The configured scope or SINGLETON if not specified
 */
export function getInjectableScope(target: Constructor): Scope {
  const scope = Reflect.getMetadata(SCOPE_METADATA_KEY, target);
  return scope ?? Scope.SINGLETON;
}

/**
 * Gets the explicit injection tokens for a class's constructor parameters
 *
 * @param target - The class to get tokens for
 * @returns A map of parameter index to injection token
 */
export function getExplicitInjectTokens(target: Constructor): Map<number, InjectionToken> {
  return Reflect.getMetadata(INJECT_METADATA_KEY, target) ?? new Map<number, InjectionToken>();
}

/**
 * Gets the set of optional parameter indices for a class's constructor
 *
 * @param target - The class to check
 * @returns A set of parameter indices marked as optional
 */
export function getOptionalParams(target: Constructor): Set<number> {
  return Reflect.getMetadata(OPTIONAL_METADATA_KEY, target) ?? new Set<number>();
}

/**
 * Gets the design-time parameter types from TypeScript metadata
 *
 * Requires `emitDecoratorMetadata: true` in tsconfig.json
 *
 * @param target - The class to get parameter types for
 * @returns Array of constructor parameter types, or undefined if not available
 */
export function getDesignParamTypes(target: Constructor): Constructor[] | undefined {
  return Reflect.getMetadata(DESIGN_PARAMTYPES_KEY, target);
}

/**
 * Gets all injection tokens for a class's constructor parameters
 *
 * Combines explicit @Inject tokens with design-time types from TypeScript.
 * Explicit tokens take precedence over inferred types.
 *
 * @param target - The class to get tokens for
 * @returns Array of injection tokens for each constructor parameter
 */
export function getConstructorTokens(target: Constructor): InjectionToken[] {
  // Get design-time types from TypeScript's metadata emission
  const designTypes = getDesignParamTypes(target) ?? [];

  // Get explicit @Inject tokens
  const explicitTokens = getExplicitInjectTokens(target);

  // Merge: explicit tokens override design types
  const tokens: InjectionToken[] = [];

  for (let i = 0; i < designTypes.length; i++) {
    const explicitToken = explicitTokens.get(i);
    if (explicitToken !== undefined) {
      // Use explicit @Inject token
      tokens.push(explicitToken);
    } else {
      // Use design-time type
      // Note: If the type is Object, it usually means the type wasn't resolved
      // (e.g., it was an interface). This will be caught at resolution time.
      tokens.push(designTypes[i] as InjectionToken);
    }
  }

  return tokens;
}

// ============================================================================
// Decorator Utilities
// ============================================================================

/**
 * Creates injectable metadata without using decorators
 *
 * Useful for environments where decorators are not supported,
 * or for programmatic registration of third-party classes.
 *
 * @param target - The class to make injectable
 * @param options - Injectable options
 *
 * @example
 * ```typescript
 * // Make a third-party class injectable
 * import { ThirdPartyService } from 'third-party-lib';
 *
 * makeInjectable(ThirdPartyService, { scope: Scope.SINGLETON });
 *
 * // Then register with explicit dependencies
 * container.register({
 *   provide: ThirdPartyService,
 *   useClass: ThirdPartyService,
 *   inject: [ConfigService]
 * });
 * ```
 */
export function makeInjectable(target: Constructor, options: InjectableOptions = {}): void {
  Reflect.defineMetadata(INJECTABLE_METADATA_KEY, true, target);
  Reflect.defineMetadata(SCOPE_METADATA_KEY, options.scope ?? Scope.SINGLETON, target);
}

/**
 * Sets explicit inject tokens for a class's constructor parameters
 *
 * Useful for programmatically setting dependency tokens without decorators.
 *
 * @param target - The class to set tokens for
 * @param tokens - Array of tokens matching constructor parameter positions
 *
 * @example
 * ```typescript
 * import { ThirdPartyService } from 'third-party-lib';
 *
 * // ThirdPartyService constructor: (config: Config, db: Database)
 * setInjectTokens(ThirdPartyService, [ConfigService, DATABASE]);
 * ```
 */
export function setInjectTokens(target: Constructor, tokens: InjectionToken[]): void {
  const tokenMap = new Map<number, InjectionToken>();
  tokens.forEach((token, index) => {
    tokenMap.set(index, token);
  });
  Reflect.defineMetadata(INJECT_METADATA_KEY, tokenMap, target);
}
