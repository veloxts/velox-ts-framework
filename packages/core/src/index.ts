/**
 * @veloxts/core - Foundation package for the VeloxTS framework
 *
 * Provides the core Fastify wrapper, plugin system, and base context
 * that all other framework packages build upon.
 *
 * @example
 * ```typescript
 * import { velox, definePlugin } from '@veloxts/core';
 *
 * const app = await velox({ port: 3030 });
 * await app.start();
 * ```
 *
 * @module @veloxts/core
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

/** VeloxTS framework version */
export const VELOX_VERSION: string = packageJson.version ?? '0.0.0-unknown';

export type { FastifyLoggerOptions, FastifyReply, FastifyRequest } from 'fastify';

export type { StartOptions } from './app.js';
export { VeloxApp, velox, veloxApp } from './app.js';
export type { BaseContext } from './context.js';
export { createContext, isContext, setupContextHook, setupTestContext } from './context.js';
// Error handling
export type {
  ConflictErrorResponse,
  ErrorCode,
  ErrorResponse,
  GenericErrorResponse,
  InterpolationVars,
  NotFoundErrorResponse,
  TooManyRequestsErrorResponse,
  ValidationErrorResponse,
  VeloxCoreErrorCode,
  VeloxErrorCode,
  VeloxErrorCodeRegistry,
} from './errors.js';
export {
  assertNever,
  ConfigurationError,
  ConflictError,
  ForbiddenError,
  fail,
  isConfigurationError,
  isConflictError,
  isForbiddenError,
  isNotFoundError,
  isNotFoundErrorResponse,
  isServiceUnavailableError,
  isTooManyRequestsError,
  isUnauthorizedError,
  isUnprocessableEntityError,
  isValidationError,
  isValidationErrorResponse,
  isVeloxError,
  isVeloxFailure,
  logDeprecation,
  logWarning,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableEntityError,
  ValidationError,
  VeloxError,
  VeloxFailure,
} from './errors.js';
export type {
  ContextPluginConfig,
  InferPluginOptions,
  PluginMetadata,
  PluginOptions,
  VeloxPlugin,
} from './plugin.js';
export {
  defineContextPlugin,
  definePlugin,
  isFastifyPlugin,
  isVeloxPlugin,
  validatePluginMetadata,
} from './plugin.js';
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

// ============================================================================
// Static File Serving
// ============================================================================

export type { CacheControl, StaticOptions } from './plugins/static.js';
export { registerStatic } from './plugins/static.js';

// ============================================================================
// Raw Body (Webhook Support)
// ============================================================================

export { rawBodyPlugin } from './plugins/raw-body.js';

// ============================================================================
// Request Logging (Development)
// ============================================================================

export { requestLogger } from './plugins/request-logger.js';

// ============================================================================
// Structured Logging
// ============================================================================

export type { Logger, LogLevel } from './utils/logger.js';
export { createLogger } from './utils/logger.js';

// ============================================================================
// Utilities
// ============================================================================

export type { FireAndForgetOptions } from './utils/fire-and-forget.js';
export { fireAndForget } from './utils/fire-and-forget.js';
export type { RetryOptions } from './utils/retry.js';
export { withRetry } from './utils/retry.js';
