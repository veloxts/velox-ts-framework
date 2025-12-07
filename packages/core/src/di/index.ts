/**
 * Dependency Injection Module
 *
 * VeloxTS provides a powerful, type-safe dependency injection container
 * inspired by Angular and NestJS, designed for the VeloxTS framework.
 *
 * Features:
 * - Class, factory, value, and alias providers
 * - Singleton, transient, and request-scoped lifecycles
 * - Automatic constructor injection via decorators
 * - Circular dependency detection
 * - Fastify integration for request-scoped services
 *
 * @example
 * ```typescript
 * import {
 *   Container,
 *   Injectable,
 *   Inject,
 *   Scope,
 *   createStringToken
 * } from '@veloxts/core';
 *
 * // Create tokens for interfaces
 * const DATABASE = createStringToken<DatabaseClient>('DATABASE');
 *
 * // Define injectable services
 * @Injectable({ scope: Scope.REQUEST })
 * class UserService {
 *   constructor(
 *     @Inject(DATABASE) private db: DatabaseClient,
 *     private config: ConfigService,
 *   ) {}
 * }
 *
 * // Register providers
 * const container = new Container();
 * container.register({
 *   provide: DATABASE,
 *   useFactory: () => createDatabaseClient(),
 *   scope: Scope.SINGLETON
 * });
 * container.register({
 *   provide: UserService,
 *   useClass: UserService,
 *   scope: Scope.REQUEST
 * });
 *
 * // Resolve services
 * const userService = container.resolve(UserService, { request });
 * ```
 *
 * @module di
 */

export type { ContainerOptions, ResolutionContext } from './container.js';
export { Container, container, createContainer } from './container.js';
export type { InjectableOptions } from './decorators.js';
export {
  getConstructorTokens,
  getExplicitInjectTokens,
  getInjectableScope,
  getOptionalParams,
  INJECT_METADATA_KEY,
  INJECTABLE_METADATA_KEY,
  Inject,
  Injectable,
  isInjectable,
  makeInjectable,
  OPTIONAL_METADATA_KEY,
  Optional,
  SCOPE_METADATA_KEY,
  setInjectTokens,
} from './decorators.js';
export type {
  ClassProvider,
  ExistingProvider,
  FactoryProvider,
  Provider,
  ValueProvider,
} from './providers.js';
export {
  asClass,
  asExisting,
  asFactory,
  asValue,
  isClassProvider,
  isExistingProvider,
  isFactoryProvider,
  isValueProvider,
  validateProvider,
} from './providers.js';
export { Scope, ScopeManager } from './scope.js';
export type {
  AbstractClass,
  ClassConstructor,
  InjectionToken,
  StringToken,
  SymbolToken,
  TokenType,
} from './tokens.js';
export {
  createStringToken,
  createSymbolToken,
  getTokenName,
  isClassToken,
  isStringToken,
  isSymbolToken,
  validateToken,
} from './tokens.js';
