/**
 * @veloxts/core - Foundation package for the VeloxTS framework
 *
 * Provides the core Fastify wrapper, plugin system, and base context
 * that all other framework packages build upon.
 *
 * @example
 * ```typescript
 * import { createVeloxApp, definePlugin } from '@veloxts/core';
 *
 * const app = await createVeloxApp({ port: 3000 });
 * await app.start();
 * ```
 *
 * @module @veloxts/core
 */

// Version constant
export const VELOX_VERSION = '0.1.0' as const;

// App creation and types
export { createVeloxApp, VeloxApp } from './app.js';
// Context system
export type { BaseContext } from './context.js';
export { createContext, isContext } from './context.js';
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
