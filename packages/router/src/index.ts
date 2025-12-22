/**
 * @veloxts/router - Procedure API with hybrid tRPC/REST routing
 *
 * Core routing abstraction that enables type-safe API endpoints with
 * automatic tRPC and REST adapter generation from procedure definitions.
 *
 * @example
 * ```typescript
 * import { procedure, defineProcedures } from '@veloxts/router';
 * import { z } from '@veloxts/validation';
 *
 * const UserSchema = z.object({
 *   id: z.string().uuid(),
 *   name: z.string(),
 *   email: z.string().email(),
 * });
 *
 * export const userProcedures = defineProcedures('users', {
 *   getUser: procedure()
 *     .input(z.object({ id: z.string().uuid() }))
 *     .output(UserSchema)
 *     .query(async ({ input, ctx }) => {
 *       // input is typed as { id: string }
 *       // ctx is typed as BaseContext
 *       // return type must match UserSchema
 *       return ctx.db.user.findUnique({ where: { id: input.id } });
 *     }),
 *
 *   createUser: procedure()
 *     .input(z.object({ name: z.string(), email: z.string().email() }))
 *     .output(UserSchema)
 *     .mutation(async ({ input, ctx }) => {
 *       return ctx.db.user.create({ data: input });
 *     }),
 * });
 * ```
 *
 * @module @veloxts/router
 */

import { createRequire } from 'node:module';

// Read version from package.json dynamically
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

/** Router package version */
export const ROUTER_VERSION: string = packageJson.version ?? '0.0.0-unknown';

// ============================================================================
// Core Types
// ============================================================================

// Type inference helpers
export type {
  // Procedure types
  CompiledProcedure,
  ContextExtensions,
  ContextFactory,
  ExtendedContext,
  // Guard types (for procedure authorization)
  GuardLike,
  HttpMethod,
  InferProcedureContext,
  InferProcedureInput,
  InferProcedureOutput,
  InferProcedureTypes,
  // Handler and middleware types
  MiddlewareArgs,
  MiddlewareFunction,
  MiddlewareNext,
  MiddlewareResult,
  // Nested routes
  ParentResourceConfig,
  // Collection types
  ProcedureCollection,
  ProcedureHandler,
  ProcedureHandlerArgs,
  ProcedureRecord,
  ProcedureType,
  RestRouteOverride,
} from './types.js';
export {
  // Constants
  PROCEDURE_METHOD_MAP,
} from './types.js';

// ============================================================================
// Errors
// ============================================================================

export type { GuardErrorResponse, RouterErrorCode } from './errors.js';
export { GuardError, isGuardError } from './errors.js';

// ============================================================================
// Procedure Builder
// ============================================================================

export type {
  // Builder options
  DefineProceduresOptions,
} from './procedure/builder.js';
export {
  // Builder functions
  defineProcedures,
  procedures, // Short alias for defineProcedures
  executeProcedure,
  isCompiledProcedure,
  isProcedureCollection,
  procedure,
} from './procedure/builder.js';
// Typed procedure factory
export { createProcedure, typedProcedure } from './procedure/factory.js';
export type {
  // Builder types
  BuilderRuntimeState,
  InferProcedures,
  InferSchemaOutput,
  ProcedureBuilder,
  ProcedureBuilderState,
  ProcedureDefinitions,
  ValidSchema,
} from './procedure/types.js';

// ============================================================================
// Naming Convention Warnings
// ============================================================================

export type { NamingWarning, NamingWarningType, WarningConfig, WarningOption } from './warnings.js';
export { analyzeNamingConvention, isDevelopment, normalizeWarningOption } from './warnings.js';

// ============================================================================
// REST Adapter
// ============================================================================

// Public API - what most users need
// Internal utilities - exported for advanced use cases and testing
// Consider moving to @veloxts/router/internal subpath in v1.1+
export type {
  ExtractRoutesType,
  RestAdapterOptions,
  RestMapping,
  RestRoute,
  RouteMap,
} from './rest/index.js';
export {
  buildNestedRestPath,
  buildRestPath,
  extractRoutes,
  followsNamingConvention,
  generateRestRoutes,
  getRouteSummary,
  inferResourceName,
  parseNamingConvention,
  registerRestRoutes,
  rest,
} from './rest/index.js';

// ============================================================================
// tRPC Adapter
// ============================================================================

export type {
  // tRPC types
  AnyRouter,
  InferAppRouter,
  TRPCInstance,
  TRPCPluginOptions,
} from './trpc/index.js';
export {
  // tRPC utilities
  appRouter,
  buildTRPCRouter,
  createTRPCContextFactory,
  registerTRPCPlugin,
  trpc,
  veloxErrorToTRPCError,
} from './trpc/index.js';

// ============================================================================
// Procedure Discovery
// ============================================================================

export type { DiscoveryOptions, DiscoveryResult, DiscoveryWarning } from './discovery/index.js';
export {
  DiscoveryError,
  DiscoveryErrorCode,
  directoryNotFound,
  discoverProcedures,
  discoverProceduresVerbose,
  fileLoadError,
  invalidExport,
  invalidFileType,
  isDiscoveryError,
  noProceduresFound,
  permissionDenied,
} from './discovery/index.js';

// ============================================================================
// Contract Utilities (Browser-Safe Type Inference)
// ============================================================================

export type {
  ContractDefinition,
  ContractEntry,
  HttpMethodRoute,
  InferContract,
  InferRouterFromContracts,
  RouteDefinition,
  RoutesDefinition,
} from './contracts.js';
export { defineContract, defineRoutes } from './contracts.js';

// ============================================================================
// Unified API Registration
// ============================================================================

export type { ServeOptions } from './expose.js';
export { serve } from './expose.js';
