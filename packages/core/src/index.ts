/**
 * @veloxts/core - Foundation package for the VeloxTS framework
 *
 * Provides the core Fastify wrapper, plugin system, base context,
 * and dependency injection container that all other framework
 * packages build upon.
 *
 * @example
 * ```typescript
 * import { veloxApp, definePlugin, Container, Injectable } from '@veloxts/core';
 *
 * const app = await veloxApp({ port: 3210 });
 * await app.start();
 * ```
 *
 * @module @veloxts/core
 */

// Import reflect-metadata for decorator support
import 'reflect-metadata';

import { createRequire } from 'node:module';

// Read version from package.json dynamically
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

/** VeloxTS framework version */
export const VELOX_VERSION: string = packageJson.version ?? '0.0.0-unknown';

// App creation and types
export { createVeloxApp, VeloxApp, veloxApp } from './app.js';
export type { StartOptions } from './app.js';
// Context system
export type { BaseContext } from './context.js';
export { createContext, isContext, setupTestContext } from './context.js';
export type {
  AbstractClass,
  ClassConstructor,
  ClassProvider,
  // Container types
  ContainerOptions,
  ExistingProvider,
  FactoryProvider,
  // Decorator types
  InjectableOptions,
  // Token types
  InjectionToken,
  // Provider types
  Provider,
  ResolutionContext,
  StringToken,
  SymbolToken,
  TokenType,
  ValueProvider,
} from './di/index.js';
// Dependency Injection
export {
  // Provider helpers (legacy)
  asClass,
  asExisting,
  asFactory,
  asValue,
  // Container
  Container,
  container,
  createContainer,
  // Tokens (legacy - deprecated)
  createStringToken,
  createSymbolToken,
  factory,
  getConstructorTokens,
  getExplicitInjectTokens,
  getInjectableScope,
  getOptionalParams,
  getTokenName,
  Inject,
  // Decorators
  Injectable,
  // Provider type guards
  isClassProvider,
  isClassToken,
  isExistingProvider,
  isFactoryProvider,
  // Decorator utilities
  isInjectable,
  isStringToken,
  isSymbolToken,
  isValueProvider,
  makeInjectable,
  Optional,
  // Scope
  Scope,
  ScopeManager,
  scoped,
  setInjectTokens,
  // Provider helpers (succinct API)
  singleton,
  // Tokens (succinct API)
  token,
  transient,
  validateProvider,
  validateToken,
  value,
} from './di/index.js';
// Error handling
export type {
  ErrorCode,
  ErrorResponse,
  GenericErrorResponse,
  InterpolationVars,
  NotFoundErrorResponse,
  ValidationErrorResponse,
  VeloxCoreErrorCode,
  VeloxErrorCode,
  VeloxErrorCodeRegistry,
} from './errors.js';
export {
  assertNever,
  ConfigurationError,
  // Elegant error creation API
  fail,
  isConfigurationError,
  isNotFoundError,
  isNotFoundErrorResponse,
  isValidationError,
  isValidationErrorResponse,
  isVeloxError,
  isVeloxFailure,
  // Developer experience utilities
  logDeprecation,
  logWarning,
  NotFoundError,
  ValidationError,
  VeloxError,
  VeloxFailure,
} from './errors.js';
export type { InferPluginOptions, PluginMetadata, PluginOptions, VeloxPlugin } from './plugin.js';
// Plugin system
export { definePlugin, isVeloxPlugin, validatePluginMetadata } from './plugin.js';
// Core types
export type {
  AsyncHandler,
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  LifecycleHook,
  ShutdownHandler,
  SyncHandler,
} from './types.js';
// Configuration
export type {
  FrozenVeloxAppConfig,
  ValidHost,
  ValidPort,
  VeloxAppConfig,
  VeloxFastifyOptions,
} from './utils/config.js';
export { isValidHost, isValidPort } from './utils/config.js';

// ============================================================================
// Typed Context Utilities
// ============================================================================

export type {
  AuthContextExtension,
  CombineContexts,
  ContextExtension,
  CoreContext,
  DbContextExtension,
  defineContext,
  MergeContext,
  SessionContextExtension,
} from './typed-context.js';
