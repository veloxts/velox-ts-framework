/**
 * @veloxts/orm/tenant - Multi-tenancy support for VeloxTS
 *
 * Schema-per-tenant isolation with PostgreSQL schemas.
 *
 * @example
 * ```typescript
 * import {
 *   createTenantClientPool,
 *   createTenantSchemaManager,
 *   createTenantProvisioner,
 *   createTenant,
 * } from '@veloxts/orm/tenant';
 *
 * // 1. Create schema manager
 * const schemaManager = createTenantSchemaManager({
 *   databaseUrl: process.env.DATABASE_URL!,
 * });
 *
 * // 2. Create client pool
 * const clientPool = createTenantClientPool({
 *   baseDatabaseUrl: process.env.DATABASE_URL!,
 *   createClient: (schemaName) => {
 *     const url = `${process.env.DATABASE_URL}?schema=${schemaName}`;
 *     const adapter = new PrismaPg({ connectionString: url });
 *     return new PrismaClient({ adapter });
 *   },
 * });
 *
 * // 3. Create provisioner
 * const provisioner = createTenantProvisioner({
 *   schemaManager,
 *   publicClient: publicDb,
 *   clientPool,
 * });
 *
 * // 4. Create tenant middleware
 * const tenant = createTenant({
 *   loadTenant: (id) => publicDb.tenant.findUnique({ where: { id } }),
 *   clientPool,
 *   publicClient: publicDb,
 * });
 *
 * // 5. Use in procedures
 * const getUsers = procedure()
 *   .use(auth.requireAuth())
 *   .use(tenant.middleware())
 *   .query(({ ctx }) => ctx.db.user.findMany());
 * ```
 *
 * @module @veloxts/orm/tenant
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Tenant entity
  Tenant,
  TenantStatus,

  // Client pool
  TenantClientPoolConfig,
  TenantClientPool,
  TenantPoolStats,
  CachedClient,

  // Middleware
  TenantMiddlewareConfig,
  TenantContextInput,
  TenantContext,

  // Schema manager
  TenantSchemaManagerConfig,
  TenantSchemaManager,
  SchemaCreateResult,
  SchemaMigrateResult,

  // Provisioner
  TenantProvisionerConfig,
  TenantProvisioner,
  TenantProvisionInput,
  TenantProvisionResult,
} from './types.js';

// ============================================================================
// Errors
// ============================================================================

export {
  // Base error
  TenantError,
  type TenantErrorCode,

  // Tenant errors
  TenantNotFoundError,
  TenantSuspendedError,
  TenantPendingError,
  TenantMigratingError,
  TenantIdMissingError,

  // Schema errors
  SchemaCreateError,
  SchemaDeleteError,
  SchemaMigrateError,
  SchemaNotFoundError,
  SchemaAlreadyExistsError,

  // Client pool errors
  ClientPoolExhaustedError,
  ClientCreateError,
  ClientDisconnectError,

  // Validation errors
  InvalidSlugError,

  // Provisioning errors
  ProvisionError,
  DeprovisionError,

  // Utilities
  isTenantError,
  getTenantStatusError,
} from './errors.js';

// ============================================================================
// Client Pool
// ============================================================================

export { createTenantClientPool } from './client-pool.js';

// ============================================================================
// Middleware
// ============================================================================

export {
  createTenantMiddleware,
  createTenant,
  hasTenant,
  getTenantOrThrow,
  type TenantNamespace,
  type MiddlewareFunction,
} from './middleware.js';

// ============================================================================
// Schema Management
// ============================================================================

export {
  createTenantSchemaManager,
  slugToSchemaName,
} from './schema/manager.js';

export { createTenantProvisioner } from './schema/provisioner.js';
