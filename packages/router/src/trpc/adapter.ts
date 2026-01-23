/**
 * tRPC adapter for procedure collections
 *
 * Converts VeloxTS procedure definitions into tRPC routers, enabling type-safe
 * API calls between frontend and backend.
 *
 * @module trpc/adapter
 */

import type {
  AnyRouter as TRPCAnyRouter,
  TRPCMutationProcedure,
  TRPCQueryProcedure,
} from '@trpc/server';
import { initTRPC, TRPCError } from '@trpc/server';
import type { BaseContext } from '@veloxts/core';
import type { FastifyInstance } from 'fastify';

/**
 * Re-exported AnyRouter type from tRPC
 *
 * This allows consumers to use AnyRouter without directly importing @trpc/server,
 * which helps avoid TypeScript compilation memory issues with tRPC v11.7+.
 */
export type AnyRouter = TRPCAnyRouter;

import { isGuardError } from '../errors.js';
import type { CompiledProcedure, ProcedureCollection, ProcedureRecord } from '../types.js';

// ============================================================================
// Type Utilities for Router Type Inference
// ============================================================================

/**
 * Maps a VeloxTS CompiledProcedure to the corresponding tRPC procedure type
 *
 * This preserves the input/output types through the type mapping, enabling
 * proper type inference when using the router on the client.
 *
 * Note: The `meta` field is required by tRPC's BuiltProcedureDef interface.
 * We use `unknown` since VeloxTS doesn't use procedure-level metadata.
 */
export type MapProcedureToTRPC<T extends CompiledProcedure> =
  T extends CompiledProcedure<infer TInput, infer TOutput, BaseContext, 'query'>
    ? TRPCQueryProcedure<{ input: TInput; output: TOutput; meta: unknown }>
    : T extends CompiledProcedure<infer TInput, infer TOutput, BaseContext, 'mutation'>
      ? TRPCMutationProcedure<{ input: TInput; output: TOutput; meta: unknown }>
      : never;

/**
 * Maps a ProcedureRecord to a tRPC router record with proper types
 *
 * This preserves each procedure's input/output types through the mapping.
 */
export type MapProcedureRecordToTRPC<T extends ProcedureRecord> = {
  [K in keyof T]: MapProcedureToTRPC<T[K]>;
};

/**
 * Extracts the namespace from a ProcedureCollection
 */
export type ExtractNamespace<T> =
  T extends ProcedureCollection<infer N, ProcedureRecord> ? N : never;

/**
 * Extracts the procedures record from a ProcedureCollection
 */
export type ExtractProcedures<T> = T extends ProcedureCollection<string, infer P> ? P : never;

/**
 * Maps a tuple of ProcedureCollections to a tRPC router record
 *
 * This creates a properly typed object where each key is the namespace
 * and each value is the mapped procedure record.
 *
 * @example
 * ```typescript
 * type Collections = [
 *   ProcedureCollection<'users', { getUser: CompiledProcedure<...> }>,
 *   ProcedureCollection<'posts', { listPosts: CompiledProcedure<...> }>
 * ];
 *
 * type Result = CollectionsToRouterRecord<Collections>;
 * // Result = {
 * //   users: { getUser: TRPCQueryProcedure<...> },
 * //   posts: { listPosts: TRPCQueryProcedure<...> }
 * // }
 * ```
 */
export type CollectionsToRouterRecord<T extends readonly ProcedureCollection[]> =
  T extends readonly []
    ? object
    : T extends readonly [infer First extends ProcedureCollection, ...infer Rest]
      ? Rest extends readonly ProcedureCollection[]
        ? {
            [K in ExtractNamespace<First>]: MapProcedureRecordToTRPC<ExtractProcedures<First>>;
          } & CollectionsToRouterRecord<Rest>
        : { [K in ExtractNamespace<First>]: MapProcedureRecordToTRPC<ExtractProcedures<First>> }
      : object;

/**
 * Infers the complete router type from procedure collections
 *
 * This is the main type that should be used for `export type AppRouter = ...`
 * to ensure full type preservation for the tRPC client.
 *
 * @example
 * ```typescript
 * const collections = [userProcedures, postProcedures] as const;
 * const router = await rpc(app, collections);
 * export type AppRouter = InferRouterFromCollections<typeof collections>;
 *
 * // Client usage:
 * // client.users.getUser({ id: '123' }) // Fully typed!
 * ```
 */
export type InferRouterFromCollections<T extends readonly ProcedureCollection[]> =
  CollectionsToRouterRecord<T>;

// ============================================================================
// tRPC Initialization
// ============================================================================

// Create a base tRPC instance for type inference
// Note: No custom errorFormatter here to keep the type simple and portable
const baseTRPC = initTRPC.context<BaseContext>().create();

/**
 * Type for a created tRPC instance
 *
 * Using typeof on a concrete instance avoids the "cannot be named" error
 * that occurs with generic type inference in tRPC v11.7+
 */
export type TRPCInstance<_TContext extends BaseContext = BaseContext> = typeof baseTRPC;

/**
 * Create a tRPC instance with VeloxTS context
 *
 * This initializes tRPC with the BaseContext type, allowing procedures
 * to access request context and plugin-provided features.
 *
 * @returns tRPC instance with context
 *
 * @example
 * ```typescript
 * const t = trpc();
 *
 * const router = t.router({
 *   hello: t.procedure.query(() => 'Hello World'),
 * });
 * ```
 */
export function trpc(): TRPCInstance {
  // Create with default options - custom error formatting removed for type compatibility
  // with tRPC v11.7+. Use veloxErrorToTRPCError() for custom error handling instead.
  return initTRPC.context<BaseContext>().create();
}

// ============================================================================
// Router Building
// ============================================================================

/**
 * Build a tRPC router from a single procedure collection
 *
 * Converts all procedures in a collection to tRPC procedures,
 * preserving type information for client inference.
 *
 * @param t - tRPC instance
 * @param collection - Procedure collection to convert
 * @returns tRPC router
 *
 * @example
 * ```typescript
 * const t = trpc();
 * const userRouter = buildTRPCRouter(t, userProcedures);
 *
 * // Router has typed procedures:
 * // userRouter.getUser({ id: '123' })
 * ```
 */
export function buildTRPCRouter(
  t: TRPCInstance<BaseContext>,
  collection: ProcedureCollection
): AnyRouter {
  // Build procedures object with explicit types
  const routerConfig: Record<string, ReturnType<typeof buildTRPCProcedure>> = {};

  for (const [name, procedure] of Object.entries(collection.procedures)) {
    routerConfig[name] = buildTRPCProcedure(t, procedure);
  }

  // Use type assertion for dynamic router creation
  // This is safe because we're building from validated procedures
  return t.router(routerConfig as Parameters<typeof t.router>[0]);
}

/**
 * Build a single tRPC procedure from a compiled VeloxTS procedure
 *
 * @internal
 */
function buildTRPCProcedure(t: TRPCInstance<BaseContext>, procedure: CompiledProcedure) {
  // Start with base procedure builder
  const baseProcedure = t.procedure;

  // Build the procedure chain based on configuration
  if (procedure.inputSchema && procedure.outputSchema) {
    // Both input and output schemas
    const withInput = baseProcedure.input(
      procedure.inputSchema as Parameters<typeof baseProcedure.input>[0]
    );
    const withOutput = withInput.output(
      procedure.outputSchema as Parameters<typeof withInput.output>[0]
    );

    const handler = createHandler(procedure);

    return procedure.type === 'query' ? withOutput.query(handler) : withOutput.mutation(handler);
  }

  if (procedure.inputSchema) {
    // Only input schema
    const withInput = baseProcedure.input(
      procedure.inputSchema as Parameters<typeof baseProcedure.input>[0]
    );

    const handler = createHandler(procedure);

    return procedure.type === 'query' ? withInput.query(handler) : withInput.mutation(handler);
  }

  if (procedure.outputSchema) {
    // Only output schema
    const withOutput = baseProcedure.output(
      procedure.outputSchema as Parameters<typeof baseProcedure.output>[0]
    );

    const handler = createNoInputHandler(procedure);

    return procedure.type === 'query' ? withOutput.query(handler) : withOutput.mutation(handler);
  }

  // No schemas - use base procedure
  const handler = createNoInputHandler(procedure);

  return procedure.type === 'query'
    ? baseProcedure.query(handler)
    : baseProcedure.mutation(handler);
}

/**
 * Create a handler function for a procedure with input
 *
 * @internal
 */
function createHandler(procedure: CompiledProcedure) {
  return async (opts: { input: unknown; ctx: BaseContext }) => {
    const { input, ctx } = opts;

    // Execute middleware chain if any
    if (procedure.middlewares.length > 0) {
      return executeWithMiddleware(procedure, input, ctx);
    }

    // Direct handler execution
    return procedure.handler({ input, ctx });
  };
}

/**
 * Create a handler function for a procedure without input
 *
 * @internal
 */
function createNoInputHandler(procedure: CompiledProcedure) {
  return async (opts: { ctx: BaseContext }) => {
    const { ctx } = opts;
    const input = undefined;

    // Execute middleware chain if any
    if (procedure.middlewares.length > 0) {
      return executeWithMiddleware(procedure, input, ctx);
    }

    // Direct handler execution
    return procedure.handler({ input, ctx });
  };
}

/**
 * Execute procedure with middleware chain
 *
 * @internal
 */
async function executeWithMiddleware(
  procedure: CompiledProcedure,
  input: unknown,
  ctx: BaseContext
): Promise<unknown> {
  // Build middleware chain from end to start
  let next = async (): Promise<{ output: unknown }> => {
    const output = await procedure.handler({ input, ctx });
    return { output };
  };

  // Wrap each middleware from last to first
  for (let i = procedure.middlewares.length - 1; i >= 0; i--) {
    const middleware = procedure.middlewares[i];
    const currentNext = next;

    next = async (): Promise<{ output: unknown }> => {
      return middleware({
        input,
        ctx,
        next: async (opts) => {
          // Allow middleware to extend context
          if (opts?.ctx) {
            Object.assign(ctx, opts.ctx);
          }
          return currentNext();
        },
      });
    };
  }

  const result = await next();
  return result.output;
}

// ============================================================================
// App Router Creation
// ============================================================================

/**
 * Create a namespaced app router from multiple procedure collections
 *
 * Each collection becomes a nested router under its namespace.
 * Use `as const` on the collections array to preserve literal types.
 *
 * @param t - tRPC instance
 * @param collections - Array of procedure collections (use `as const` for best type inference)
 * @returns Merged app router with preserved types
 *
 * @example
 * ```typescript
 * const t = trpc();
 * const router = appRouter(t, [
 *   userProcedures,    // namespace: 'users'
 *   postProcedures,    // namespace: 'posts'
 * ] as const);
 *
 * // Usage:
 * // router.users.getUser({ id: '123' })
 * // router.posts.listPosts({ page: 1 })
 *
 * // Export type for client - fully typed!
 * export type AppRouter = typeof router;
 * ```
 */
export function appRouter<const T extends readonly ProcedureCollection[]>(
  t: TRPCInstance<BaseContext>,
  collections: T
): AnyRouter & InferRouterFromCollections<T> {
  const routerConfig: Record<string, AnyRouter> = {};

  for (const collection of collections) {
    routerConfig[collection.namespace] = buildTRPCRouter(t, collection);
  }

  return t.router(routerConfig as unknown as Parameters<typeof t.router>[0]) as AnyRouter &
    InferRouterFromCollections<T>;
}

/**
 * Helper type to infer the AppRouter type from procedure collections
 *
 * @deprecated Use `InferRouterFromCollections<T>` instead for better type inference.
 * This type alias is kept for backward compatibility.
 */
export type InferAppRouter<
  T extends readonly ProcedureCollection[] = readonly ProcedureCollection[],
> = InferRouterFromCollections<T>;

// ============================================================================
// @trpc/react-query Compatibility
// ============================================================================

/**
 * Transforms a VeloxTS router type (from `createRouter` or `toRouter`) to be
 * compatible with `@trpc/react-query`'s `createTRPCReact<T>()`.
 *
 * Use this when you want to use VeloxTS procedures with the standard tRPC React hooks.
 *
 * @example
 * ```typescript
 * // Backend: Define router with createRouter
 * import { createRouter } from '@veloxts/router';
 * import { userProcedures, postProcedures } from './procedures';
 *
 * export const { router } = createRouter(userProcedures, postProcedures);
 * export type AppRouter = typeof router;
 *
 * // Frontend: Use with @trpc/react-query
 * import { createTRPCReact } from '@trpc/react-query';
 * import type { AsTRPCRouter } from '@veloxts/router';
 * import type { AppRouter } from '../server/router';
 *
 * export const trpc = createTRPCReact<AsTRPCRouter<AppRouter>>();
 *
 * // Full type safety works:
 * const { data } = trpc.users.getUser.useQuery({ id: '123' });
 * //                     ^ autocomplete    ^ typed input   ^ typed output
 * ```
 *
 * @remarks
 * This type transformer handles the structural differences between VeloxTS's
 * `RouterFromCollections` type and tRPC's expected router shape:
 *
 * - Transforms `ProcedureCollection<N, P>` namespaces to tRPC procedure records
 * - Maps `CompiledProcedure<I, O, C, 'query'>` to `TRPCQueryProcedure`
 * - Maps `CompiledProcedure<I, O, C, 'mutation'>` to `TRPCMutationProcedure`
 * - Adds required tRPC router metadata (`_def`, `createCaller`)
 *
 * @see {@link InferRouterFromCollections} for transforming collections array types
 */
export type AsTRPCRouter<TRouter> = TRouter extends Record<
  string,
  ProcedureCollection<string, ProcedureRecord>
>
  ? TRPCRouterShell & TransformNamespacesToTRPC<TRouter>
  : never;

/**
 * Transforms each namespace in the router to tRPC procedure records
 *
 * @internal
 */
type TransformNamespacesToTRPC<T extends Record<string, ProcedureCollection<string, ProcedureRecord>>> = {
  [K in keyof T]: T[K] extends ProcedureCollection<string, infer P extends ProcedureRecord>
    ? MapProcedureRecordToTRPC<P>
    : never;
};

/**
 * Minimal tRPC router shell type for @trpc/react-query compatibility
 *
 * This provides the structural properties that tRPC's type system expects,
 * without requiring an actual tRPC router instance.
 *
 * @internal
 */
type TRPCRouterShell = {
  _def: {
    _config: {
      $types: {
        ctx: BaseContext;
        meta: unknown;
      };
    };
    record: Record<string, unknown>;
    procedures: Record<string, unknown>;
  };
  createCaller: (ctx: unknown) => unknown;
};

// ============================================================================
// Context Utilities
// ============================================================================

/**
 * Create a tRPC context factory for Fastify
 *
 * This factory creates the context for each tRPC request,
 * pulling from the Fastify request's decorated context.
 *
 * @template TContext - Context type
 * @returns Context factory function
 *
 * @example
 * ```typescript
 * import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
 *
 * await server.register(fastifyTRPCPlugin, {
 *   prefix: '/trpc',
 *   trpcOptions: {
 *     router: appRouter,
 *     createContext: createTRPCContextFactory(),
 *   },
 * });
 * ```
 */
export function createTRPCContextFactory() {
  return ({ req }: { req: { context?: BaseContext } }): BaseContext => {
    if (!req.context) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          'Request context not found. Ensure @veloxts/core is properly initialized ' +
          'and the VeloxApp is started before registering tRPC routes.',
      });
    }
    return req.context;
  };
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Convert a VeloxTS error to a tRPC error
 *
 * Maps VeloxTS error codes to appropriate tRPC error codes.
 * Handles GuardError specifically to preserve guard metadata.
 *
 * @param error - Error to convert
 * @param defaultCode - Default tRPC code if mapping not found
 * @returns TRPCError
 */
export function veloxErrorToTRPCError(
  error: Error & { statusCode?: number; code?: string },
  defaultCode: TRPCError['code'] = 'INTERNAL_SERVER_ERROR'
): TRPCError {
  // Map HTTP status codes to tRPC codes
  const statusToTRPC: Record<number, TRPCError['code']> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    408: 'TIMEOUT',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_CONTENT',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
  };

  const trpcCode = error.statusCode ? (statusToTRPC[error.statusCode] ?? defaultCode) : defaultCode;

  // Handle GuardError specifically to preserve guard metadata
  if (isGuardError(error)) {
    return new TRPCError({
      code: trpcCode,
      message: error.message,
      cause: {
        code: error.code,
        guardName: error.guardName,
      },
    });
  }

  return new TRPCError({
    code: trpcCode,
    message: error.message,
    cause: error.code,
  });
}

/**
 * Type guard for tRPC errors with VeloxTS cause
 *
 * Use this when handling errors that may have been converted from VeloxTS errors
 * using veloxErrorToTRPCError().
 */
export function isVeloxTRPCError(error: TRPCError): error is TRPCError & { cause: string } {
  return typeof error.cause === 'string';
}

// ============================================================================
// Fastify Plugin Registration
// ============================================================================

/**
 * Options for tRPC plugin registration
 */
export interface TRPCPluginOptions {
  /** URL prefix for tRPC routes (default: '/trpc') */
  prefix?: string;
  /** tRPC router created with appRouter */
  router: AnyRouter;
}

/**
 * Register tRPC plugin with Fastify server
 *
 * This is a convenience wrapper around fastifyTRPCPlugin that handles
 * the context factory automatically.
 *
 * @param server - Fastify server instance
 * @param options - tRPC plugin options
 *
 * @example
 * ```typescript
 * const app = await veloxApp({ port: 3030 });
 * const t = trpc();
 * const router = appRouter(t, [userProcedures]);
 *
 * await registerTRPCPlugin(app.server, {
 *   prefix: '/trpc',
 *   router,
 * });
 * ```
 */
export async function registerTRPCPlugin(
  server: FastifyInstance,
  options: TRPCPluginOptions
): Promise<void> {
  // Dynamic import to avoid pulling in complex types at compile time
  const { fastifyTRPCPlugin } = await import('@trpc/server/adapters/fastify');

  await server.register(fastifyTRPCPlugin, {
    prefix: options.prefix ?? '/trpc',
    trpcOptions: {
      router: options.router,
      createContext: createTRPCContextFactory(),
    },
  });
}
