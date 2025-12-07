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
export { veloxApp, createVeloxApp, VeloxApp } from './app.js';
// Context system
export type { BaseContext } from './context.js';
export { createContext, isContext, setupTestContext } from './context.js';
// Error handling
export type {
  ErrorResponse,
  GenericErrorResponse,
  NotFoundErrorResponse,
  ValidationErrorResponse,
  VeloxCoreErrorCode,
  VeloxErrorCode,
  VeloxErrorCodeRegistry,
} from './errors.js';
export {
  assertNever,
  ConfigurationError,
  isConfigurationError,
  isNotFoundError,
  isNotFoundErrorResponse,
  isValidationError,
  isValidationErrorResponse,
  isVeloxError,
  NotFoundError,
  ValidationError,
  VeloxError,
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

// Dependency Injection
export {
  // Container
  Container,
  container,
  createContainer,
  // Decorators
  Injectable,
  Inject,
  Optional,
  // Decorator utilities
  isInjectable,
  getInjectableScope,
  getConstructorTokens,
  getExplicitInjectTokens,
  getOptionalParams,
  makeInjectable,
  setInjectTokens,
  // Provider helpers (succinct API)
  singleton,
  scoped,
  transient,
  value,
  factory,
  // Provider helpers (legacy)
  asClass,
  asFactory,
  asValue,
  asExisting,
  // Provider type guards
  isClassProvider,
  isFactoryProvider,
  isValueProvider,
  isExistingProvider,
  validateProvider,
  // Scope
  Scope,
  ScopeManager,
  // Tokens (succinct API)
  token,
  // Tokens (legacy - deprecated)
  createStringToken,
  createSymbolToken,
  getTokenName,
  isClassToken,
  isStringToken,
  isSymbolToken,
  validateToken,
} from './di/index.js';
export type {
  // Container types
  ContainerOptions,
  ResolutionContext,
  // Decorator types
  InjectableOptions,
  // Provider types
  Provider,
  ClassProvider,
  FactoryProvider,
  ValueProvider,
  ExistingProvider,
  // Token types
  InjectionToken,
  ClassConstructor,
  AbstractClass,
  StringToken,
  SymbolToken,
  TokenType,
} from './di/index.js';
