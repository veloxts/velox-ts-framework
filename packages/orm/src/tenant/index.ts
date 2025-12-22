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
  CachedClient,
  SchemaCreateResult,
  SchemaMigrateResult,
  // Tenant entity
  Tenant,
  TenantClientPool,
  // Client pool
  TenantClientPoolConfig,
  TenantContext,
  TenantContextInput,
  // Middleware
  TenantMiddlewareConfig,
  TenantPoolStats,
  TenantProvisioner,
  // Provisioner
  TenantProvisionerConfig,
  TenantProvisionInput,
  TenantProvisionResult,
  TenantSchemaManager,
  // Schema manager
  TenantSchemaManagerConfig,
  TenantStatus,
} from './types.js';

// ============================================================================
// Errors
// ============================================================================

export {
  ClientCreateError,
  ClientDisconnectError,
  // Client pool errors
  ClientPoolExhaustedError,
  DeprovisionError,
  getTenantStatusError,
  // Validation errors
  InvalidSlugError,
  // Utilities
  isTenantError,
  // Provisioning errors
  ProvisionError,
  SchemaAlreadyExistsError,
  // Schema errors
  SchemaCreateError,
  SchemaDeleteError,
  SchemaMigrateError,
  SchemaNotFoundError,
  // Authorization error
  TenantAccessDeniedError,
  // Base error
  TenantError,
  type TenantErrorCode,
  TenantIdMissingError,
  TenantMigratingError,
  // Tenant errors
  TenantNotFoundError,
  TenantPendingError,
  TenantSuspendedError,
} from './errors.js';

// ============================================================================
// Client Pool
// ============================================================================

export { createTenantClientPool } from './client-pool.js';

// ============================================================================
// Middleware
// ============================================================================

export {
  createTenant,
  createTenantMiddleware,
  getTenantOrThrow,
  hasTenant,
  type MiddlewareFunction,
  type TenantNamespace,
} from './middleware.js';

// ============================================================================
// Schema Management
// ============================================================================

export {
  createTenantSchemaManager,
  slugToSchemaName,
} from './schema/manager.js';
export { createTenantProvisioner } from './schema/provisioner.js';
