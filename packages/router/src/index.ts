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
  executeProcedure,
  isCompiledProcedure,
  isProcedureCollection,
  procedure,
  procedures, // Short alias for defineProcedures
} from './procedure/builder.js';

// ============================================================================
// Router Utilities
// ============================================================================

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
export type { RouterResult } from './router-utils.js';
export { createRouter, toRouter } from './router-utils.js';

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
  // @trpc/react-query compatibility
  AsTRPCRouter,
  // Type utilities for router type inference
  CollectionsToRouterRecord,
  ExtractNamespace,
  ExtractProcedures,
  InferAppRouter,
  InferRouterFromCollections,
  MapProcedureRecordToTRPC,
  MapProcedureToTRPC,
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
// RPC Helper (tRPC Registration)
// ============================================================================

export type { RpcOptions, RpcResult } from './rpc.js';
export { registerRpc, rpc } from './rpc.js';

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
// Unified API Registration
// ============================================================================

export type { ServeOptions } from './expose.js';
export { serve } from './expose.js';

// ============================================================================
// Dependency Injection
// ============================================================================

/**
 * DI tokens and providers for @veloxts/router
 *
 * Use these to integrate router services with the @veloxts/core DI container.
 *
 * @example
 * ```typescript
 * import { Container } from '@veloxts/core';
 * import { registerRouterProviders, TRPC_INSTANCE, APP_ROUTER } from '@veloxts/router';
 *
 * const container = new Container();
 * registerRouterProviders(container, {
 *   procedures: [userProcedures, postProcedures],
 * });
 *
 * const t = container.resolve(TRPC_INSTANCE);
 * const router = container.resolve(APP_ROUTER);
 * ```
 */

// Provider exports - factory functions for registering services
export {
  appRouterProvider,
  registerRouterProviders,
  trpcInstanceProvider,
  trpcPluginOptionsProvider,
} from './providers.js';
// Token exports - unique identifiers for DI resolution
export type { RestAdapterConfig, RouterConfig } from './tokens.js';
export {
  APP_ROUTER,
  PROCEDURE_COLLECTIONS,
  REST_ADAPTER_CONFIG,
  ROUTER_CONFIG,
  TRPC_INSTANCE,
  TRPC_PLUGIN_OPTIONS,
} from './tokens.js';

// ============================================================================
// OpenAPI Generation
// ============================================================================

/**
 * OpenAPI 3.0.3 specification generation from procedure collections.
 *
 * @example
 * ```typescript
 * import { generateOpenApiSpec, swaggerUIPlugin } from '@veloxts/router';
 *
 * // Generate spec programmatically
 * const spec = generateOpenApiSpec([userProcedures], {
 *   info: { title: 'My API', version: '1.0.0' },
 * });
 *
 * // Or serve Swagger UI
 * app.register(swaggerUIPlugin, {
 *   routePrefix: '/docs',
 *   collections: [userProcedures],
 *   openapi: { info: { title: 'My API', version: '1.0.0' } },
 * });
 * ```
 */

export type {
  // Generator options
  BuildParametersOptions,
  BuildParametersResult,
  GuardMappingOptions,
  // OpenAPI types
  JSONSchema,
  OpenAPIComponents,
  OpenAPIContact,
  OpenAPIEncoding,
  OpenAPIExample,
  OpenAPIExternalDocs,
  OpenAPIGeneratorOptions,
  OpenAPIHeader,
  OpenAPIHttpMethod,
  OpenAPIInfo,
  OpenAPILicense,
  OpenAPILink,
  OpenAPIMediaType,
  OpenAPIOAuthFlow,
  OpenAPIOAuthFlows,
  OpenAPIOperation,
  OpenAPIParameter,
  OpenAPIPathItem,
  OpenAPIRequestBody,
  OpenAPIResponse,
  OpenAPISecurityRequirement,
  OpenAPISecurityScheme,
  OpenAPIServer,
  OpenAPISpec,
  OpenAPITag,
  ParameterIn,
  QueryParamExtractionOptions,
  RouteInfo,
  SchemaConversionOptions,
  SecuritySchemeType,
  SwaggerUIConfig,
  SwaggerUIPluginOptions,
} from './openapi/index.js';
export {
  // Path extractor
  buildParameters,
  convertFromOpenAPIPath,
  convertToOpenAPIPath,
  // Security mapper
  createSecurityRequirement,
  // Schema converter
  createStringSchema,
  // Plugin
  createSwaggerUI,
  DEFAULT_GUARD_MAPPINGS,
  DEFAULT_SECURITY_SCHEMES,
  extractGuardScopes,
  extractPathParamNames,
  extractQueryParameters,
  extractResourceFromPath,
  extractSchemaProperties,
  extractUsedSecuritySchemes,
  filterUsedSecuritySchemes,
  // Generator
  generateOpenApiSpec,
  getOpenApiRouteSummary,
  getOpenApiSpec,
  guardsRequireAuth,
  guardsToSecurity,
  hasPathParameters,
  joinPaths,
  mapGuardToSecurity,
  mergeSchemas,
  mergeSecuritySchemes,
  normalizePath,
  parsePathParameters,
  registerDocs,
  removeSchemaProperties,
  schemaHasProperties,
  swaggerUIPlugin,
  validateOpenApiSpec,
  zodSchemaToJsonSchema,
} from './openapi/index.js';
