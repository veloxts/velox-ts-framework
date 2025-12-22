/**
 * Tenant middleware for procedure handlers
 *
 * Resolves tenant from JWT claims and provides tenant-scoped database access.
 */

import type { DatabaseClient } from '../types.js';
import type {
  Tenant,
  TenantMiddlewareConfig,
  TenantContextInput,
  TenantContext,
  TenantClientPool,
} from './types.js';
import {
  TenantIdMissingError,
  TenantNotFoundError,
  getTenantStatusError,
} from './errors.js';

/**
 * Middleware function type compatible with tRPC/procedure middleware
 */
export type MiddlewareFunction<TInput, TOutput> = (opts: {
  ctx: TInput;
  next: (opts: { ctx: TOutput }) => Promise<unknown>;
}) => Promise<unknown>;

/**
 * Create tenant middleware for procedures
 *
 * This middleware:
 * 1. Extracts tenantId from JWT claims (ctx.auth.token.tenantId)
 * 2. Loads tenant from public schema
 * 3. Validates tenant status (must be 'active')
 * 4. Gets a tenant-scoped database client from the pool
 * 5. Extends context with tenant info and scoped db client
 *
 * @example
 * ```typescript
 * const tenantMw = createTenantMiddleware({
 *   loadTenant: async (tenantId) => publicDb.tenant.findUnique({ where: { id: tenantId } }),
 *   clientPool,
 *   publicClient: publicDb,
 * });
 *
 * // Use in procedures
 * const getUsers = procedure()
 *   .use(auth.requireAuth())
 *   .use(tenantMw)
 *   .query(({ ctx }) => ctx.db.user.findMany());
 * ```
 */
export function createTenantMiddleware<TClient extends DatabaseClient>(
  config: TenantMiddlewareConfig<TClient>
): MiddlewareFunction<TenantContextInput, TenantContextInput & TenantContext<TClient>> {
  const {
    loadTenant,
    clientPool,
    publicClient,
    getTenantId = defaultGetTenantId,
    allowNoTenant = false,
  } = config;

  return async ({ ctx, next }) => {
    // Extract tenant ID from context
    const tenantId = getTenantId(ctx);

    if (!tenantId) {
      if (allowNoTenant) {
        // Continue without tenant context
        return next({
          ctx: ctx as TenantContextInput & TenantContext<TClient>,
        });
      }
      throw new TenantIdMissingError();
    }

    // Load tenant from database
    const tenant = await loadTenant(tenantId);

    if (!tenant) {
      throw new TenantNotFoundError(tenantId);
    }

    // Validate tenant status
    const statusError = getTenantStatusError(tenantId, tenant.status);
    if (statusError) {
      throw statusError;
    }

    // Get tenant-scoped database client
    const db = await clientPool.getClient(tenant.schemaName);

    // Build extended context
    const extendedCtx: TenantContextInput & TenantContext<TClient> = {
      ...ctx,
      tenant,
      db,
      ...(publicClient ? { publicDb: publicClient } : {}),
    };

    try {
      // Continue to next middleware/handler
      return await next({ ctx: extendedCtx });
    } finally {
      // Release client back to pool
      clientPool.releaseClient(tenant.schemaName);
    }
  };
}

/**
 * Default tenant ID extractor from JWT claims
 */
function defaultGetTenantId(ctx: TenantContextInput): string | undefined {
  return ctx.auth?.token?.tenantId;
}

/**
 * Create a tenant namespace object with middleware and helpers
 *
 * Provides a cleaner API similar to auth package pattern.
 *
 * @example
 * ```typescript
 * const tenant = createTenant({
 *   loadTenant: async (id) => publicDb.tenant.findUnique({ where: { id } }),
 *   clientPool,
 *   publicClient: publicDb,
 * });
 *
 * // Use the middleware
 * const procedure = baseProcedure
 *   .use(auth.requireAuth())
 *   .use(tenant.middleware());
 * ```
 */
export function createTenant<TClient extends DatabaseClient>(
  config: TenantMiddlewareConfig<TClient>
): TenantNamespace<TClient> {
  const middleware = createTenantMiddleware(config);
  const { clientPool, publicClient, loadTenant } = config;

  return {
    /**
     * Middleware that requires tenant context
     */
    middleware: () => middleware,

    /**
     * Middleware that makes tenant context optional
     */
    optionalMiddleware: () =>
      createTenantMiddleware({
        ...config,
        allowNoTenant: true,
      }),

    /**
     * Get the client pool for direct access
     */
    getClientPool: () => clientPool,

    /**
     * Get the public client
     */
    getPublicClient: () => publicClient,

    /**
     * Load a tenant by ID
     */
    loadTenant,

    /**
     * Get a tenant-scoped client directly
     */
    getClient: (schemaName: string) => clientPool.getClient(schemaName),
  };
}

/**
 * Tenant namespace interface
 */
export interface TenantNamespace<TClient extends DatabaseClient> {
  middleware: () => MiddlewareFunction<
    TenantContextInput,
    TenantContextInput & TenantContext<TClient>
  >;
  optionalMiddleware: () => MiddlewareFunction<
    TenantContextInput,
    TenantContextInput & Partial<TenantContext<TClient>>
  >;
  getClientPool: () => TenantClientPool<TClient>;
  getPublicClient: () => TClient | undefined;
  loadTenant: (tenantId: string) => Promise<Tenant | null>;
  getClient: (schemaName: string) => Promise<TClient>;
}

/**
 * Type guard to check if context has tenant
 */
export function hasTenant<TClient extends DatabaseClient>(
  ctx: TenantContextInput
): ctx is TenantContextInput & TenantContext<TClient> {
  return (
    ctx !== null &&
    typeof ctx === 'object' &&
    'tenant' in ctx &&
    ctx.tenant !== null &&
    typeof ctx.tenant === 'object' &&
    'db' in ctx &&
    ctx.db !== null
  );
}

/**
 * Get tenant from context or throw
 */
export function getTenantOrThrow<TClient extends DatabaseClient>(
  ctx: TenantContextInput
): TenantContext<TClient> {
  if (!hasTenant<TClient>(ctx)) {
    throw new TenantIdMissingError();
  }
  return ctx as TenantContext<TClient>;
}
