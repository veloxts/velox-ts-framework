/**
 * Service tokens for dependency injection
 *
 * Tokens are unique identifiers used to register and resolve services.
 * VeloxTS supports three token types:
 * - Class tokens: The class constructor itself
 * - String tokens: String literals for named services
 * - Symbol tokens: Unique symbols for collision-free tokens
 *
 * @module di/tokens
 */

import { VeloxError } from '../errors.js';

// ============================================================================
// Token Types
// ============================================================================

/**
 * Abstract class token type
 *
 * Represents a class constructor that can be used as a service token.
 * Supports both concrete classes and abstract classes.
 *
 * @template T - The type that the class constructs
 */
export interface AbstractClass<T = unknown> {
  prototype: T;
}

/**
 * Concrete class constructor type
 *
 * Represents a class that can be instantiated with `new`.
 * The constructor accepts any arguments and returns an instance of T.
 *
 * @template T - The type that the class constructs
 */
export interface ClassConstructor<T = unknown> extends AbstractClass<T> {
  new (...args: never[]): T;
}

/**
 * Unique brand symbol for string tokens (compile-time only)
 * @internal
 */
declare const StringTokenBrand: unique symbol;

/**
 * Unique brand symbol for symbol tokens (compile-time only)
 * @internal
 */
declare const SymbolTokenBrand: unique symbol;

/**
 * String token type for named services
 *
 * Branded type to distinguish service tokens from regular strings at compile time.
 * The brand is purely a compile-time construct for type safety.
 *
 * @example
 * ```typescript
 * const DATABASE = createStringToken<DatabaseClient>('DATABASE');
 * container.register({ provide: DATABASE, useFactory: () => createDb() });
 * ```
 */
export type StringToken<T = unknown> = string & { readonly [StringTokenBrand]: T };

/**
 * Symbol token type for unique service identifiers
 *
 * Branded type that carries the service type information.
 * The brand is purely a compile-time construct for type safety.
 *
 * @example
 * ```typescript
 * const LOGGER = createSymbolToken<Logger>('LOGGER');
 * container.register({ provide: LOGGER, useClass: ConsoleLogger });
 * ```
 */
export type SymbolToken<T = unknown> = symbol & { readonly [SymbolTokenBrand]: T };

/**
 * Union of all valid injection token types
 *
 * A token can be:
 * - A class constructor (for automatic injection)
 * - A string token (for named services)
 * - A symbol token (for unique identifiers)
 *
 * @template T - The type of service the token represents
 */
export type InjectionToken<T = unknown> =
  | ClassConstructor<T>
  | AbstractClass<T>
  | StringToken<T>
  | SymbolToken<T>;

/**
 * Extract the type from an injection token
 *
 * @template T - The injection token type
 *
 * @example
 * ```typescript
 * type UserServiceType = TokenType<typeof UserService>; // UserService
 * type DbType = TokenType<typeof DATABASE>; // DatabaseClient
 * ```
 */
export type TokenType<T> = T extends InjectionToken<infer U> ? U : never;

// ============================================================================
// Token Creation Functions
// ============================================================================

/**
 * Creates a typed string token for service registration
 *
 * String tokens are useful when you want human-readable identifiers.
 * The type parameter ensures type safety when resolving the service.
 *
 * @template T - The type of service this token represents
 * @param name - The string identifier for this token
 * @returns A typed string token
 *
 * @example
 * ```typescript
 * interface DatabaseClient {
 *   query(sql: string): Promise<unknown>;
 * }
 *
 * const DATABASE = createStringToken<DatabaseClient>('DATABASE');
 *
 * // Registration
 * container.register({
 *   provide: DATABASE,
 *   useFactory: () => createDatabaseClient()
 * });
 *
 * // Resolution - type is inferred as DatabaseClient
 * const db = container.resolve(DATABASE);
 * await db.query('SELECT * FROM users');
 * ```
 */
export function createStringToken<T>(name: string): StringToken<T> {
  return name as StringToken<T>;
}

/**
 * Creates a typed symbol token for service registration
 *
 * Symbol tokens guarantee uniqueness across the application,
 * preventing name collisions between different modules.
 *
 * @template T - The type of service this token represents
 * @param description - Optional description for debugging
 * @returns A typed symbol token
 *
 * @example
 * ```typescript
 * interface Logger {
 *   log(message: string): void;
 * }
 *
 * const LOGGER = createSymbolToken<Logger>('Logger');
 *
 * // Registration
 * container.register({
 *   provide: LOGGER,
 *   useClass: ConsoleLogger
 * });
 *
 * // Resolution - type is inferred as Logger
 * const logger = container.resolve(LOGGER);
 * logger.log('Hello, world!');
 * ```
 */
export function createSymbolToken<T>(description?: string): SymbolToken<T> {
  return Symbol(description) as SymbolToken<T>;
}

// ============================================================================
// Succinct Token API
// ============================================================================

/**
 * Creates a typed string token for service registration
 *
 * This is the preferred API for creating tokens. String tokens are
 * useful when you want human-readable identifiers.
 *
 * @template T - The type of service this token represents
 * @param name - The string identifier for this token
 * @returns A typed string token
 *
 * @example
 * ```typescript
 * const DATABASE = token<DatabaseClient>('DATABASE');
 * const CONFIG = token<AppConfig>('CONFIG');
 *
 * container.register({ provide: DATABASE, useFactory: createDb });
 * ```
 */
export function token<T>(name: string): StringToken<T> {
  return name as StringToken<T>;
}

/**
 * Token creation namespace with factory methods
 *
 * Provides a succinct, grouped API for creating different token types.
 *
 * @example
 * ```typescript
 * // String token (most common)
 * const DATABASE = token<DatabaseClient>('DATABASE');
 *
 * // Symbol token (guaranteed unique)
 * const LOGGER = token.symbol<Logger>('LOGGER');
 * ```
 */
token.symbol = function symbolToken<T>(description?: string): SymbolToken<T> {
  return Symbol(description) as SymbolToken<T>;
};

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Gets a human-readable name for a token
 *
 * @param token - The token to get the name for
 * @returns A string representation of the token
 *
 * @internal
 */
export function getTokenName(token: InjectionToken): string {
  // Cast to unknown for proper typeof narrowing without IDE warnings
  // This is safe because InjectionToken runtime values are always string | symbol | function
  const rawToken: unknown = token;

  if (typeof rawToken === 'string') {
    return rawToken;
  }

  if (typeof rawToken === 'symbol') {
    return rawToken.description ?? 'Symbol()';
  }

  if (typeof rawToken === 'function') {
    return rawToken.name || 'AnonymousClass';
  }

  return 'Unknown';
}

/**
 * Type guard for class constructor tokens
 *
 * @param token - The token to check
 * @returns true if the token is a class constructor
 */
export function isClassToken(token: InjectionToken): token is ClassConstructor {
  return typeof token === 'function';
}

/**
 * Type guard for string tokens
 *
 * @param token - The token to check
 * @returns true if the token is a string token
 */
export function isStringToken(token: InjectionToken): token is StringToken {
  return typeof token === 'string';
}

/**
 * Type guard for symbol tokens
 *
 * @param token - The token to check
 * @returns true if the token is a symbol token
 */
export function isSymbolToken(token: InjectionToken): token is SymbolToken {
  // Cast to unknown for proper typeof narrowing without IDE warnings
  return typeof (token as unknown) === 'symbol';
}

/**
 * Validates that a token is a valid injection token
 *
 * @param token - The value to validate
 * @throws {VeloxError} If the token is not valid
 *
 * @internal
 */
export function validateToken(token: unknown): asserts token is InjectionToken {
  if (token === null || token === undefined) {
    throw new VeloxError(
      'Injection token cannot be null or undefined',
      500,
      'INVALID_INJECTION_TOKEN'
    );
  }

  const tokenType = typeof token;

  if (tokenType !== 'string' && tokenType !== 'symbol' && tokenType !== 'function') {
    throw new VeloxError(
      `Invalid injection token type: ${tokenType}. Expected string, symbol, or class constructor.`,
      500,
      'INVALID_INJECTION_TOKEN'
    );
  }
}

// ============================================================================
// Token Registry Extension
// ============================================================================

/**
 * Extend the error code registry for DI-related errors
 */
declare module '../errors.js' {
  interface VeloxErrorCodeRegistry {
    di:
      | 'INVALID_INJECTION_TOKEN'
      | 'SERVICE_NOT_FOUND'
      | 'CIRCULAR_DEPENDENCY'
      | 'MISSING_INJECTABLE_DECORATOR'
      | 'INVALID_PROVIDER'
      | 'SCOPE_MISMATCH'
      | 'REQUEST_SCOPE_UNAVAILABLE';
  }
}
