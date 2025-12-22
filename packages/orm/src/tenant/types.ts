/**
 * Multi-tenancy type definitions for @veloxts/orm/tenant
 *
 * Schema-per-tenant isolation with PostgreSQL schemas.
 */

import type { DatabaseClient } from '../types.js';

// ============================================================================
// Tenant Entity
// ============================================================================

/**
 * Tenant status lifecycle states
 */
export type TenantStatus = 'active' | 'suspended' | 'pending' | 'migrating';

/**
 * Tenant entity representing a single tenant in the system
 */
export interface Tenant {
  /** Unique tenant identifier (UUID) */
  id: string;
  /** URL-safe slug for the tenant (e.g., 'acme-corp') */
  slug: string;
  /** Human-readable tenant name */
  name: string;
  /** PostgreSQL schema name (e.g., 'tenant_acme_corp') */
  schemaName: string;
  /** Current tenant status */
  status: TenantStatus;
  /** ISO timestamp when tenant was created */
  createdAt: Date;
  /** ISO timestamp when tenant was last updated */
  updatedAt: Date;
}

// ============================================================================
// Client Pool Configuration
// ============================================================================

/**
 * Configuration for tenant client pool
 */
export interface TenantClientPoolConfig<TClient extends DatabaseClient> {
  /**
   * Base database URL (without schema parameter)
   * @example 'postgresql://user:pass@localhost:5432/mydb'
   */
  baseDatabaseUrl: string;

  /**
   * Factory function to create a new PrismaClient for a tenant schema
   *
   * @param schemaName - The PostgreSQL schema name to connect to
   * @returns A new PrismaClient instance configured for the schema
   *
   * @example
   * ```typescript
   * createClient: (schemaName) => {
   *   const url = `${baseUrl}?schema=${schemaName}`;
   *   const adapter = new PrismaPg({ connectionString: url });
   *   return new PrismaClient({ adapter });
   * }
   * ```
   */
  createClient: (schemaName: string) => TClient;

  /**
   * Maximum number of concurrent clients in the pool
   * @default 50
   */
  maxClients?: number;

  /**
   * Idle timeout in milliseconds before evicting unused clients
   * @default 300000 (5 minutes)
   */
  idleTimeoutMs?: number;
}

/**
 * Cached client entry with metadata
 */
export interface CachedClient<TClient extends DatabaseClient> {
  /** The database client instance */
  client: TClient;
  /** Schema this client is connected to */
  schemaName: string;
  /** Timestamp when client was last accessed */
  lastAccessedAt: number;
  /** Timestamp when client was created */
  createdAt: number;
}

// ============================================================================
// Middleware Configuration
// ============================================================================

/**
 * Configuration for tenant middleware
 */
export interface TenantMiddlewareConfig<TClient extends DatabaseClient> {
  /**
   * Function to load tenant from public schema by ID
   *
   * @param tenantId - The tenant ID from JWT claim
   * @returns The tenant entity or null if not found
   *
   * @example
   * ```typescript
   * loadTenant: async (tenantId) => {
   *   return publicDb.tenant.findUnique({ where: { id: tenantId } });
   * }
   * ```
   */
  loadTenant: (tenantId: string) => Promise<Tenant | null>;

  /**
   * Client pool for obtaining tenant-scoped database clients
   */
  clientPool: TenantClientPool<TClient>;

  /**
   * Optional: Public database client for shared data
   * If provided, will be available as ctx.publicDb
   */
  publicClient?: TClient;

  /**
   * Extract tenant ID from context
   * @default Extracts from ctx.auth.token.tenantId (JWT claim)
   */
  getTenantId?: (ctx: TenantContextInput) => string | undefined;

  /**
   * Allow requests without tenant context
   * Useful for public endpoints that don't require tenant isolation
   * @default false
   */
  allowNoTenant?: boolean;

  /**
   * SECURITY: Verify user has access to the requested tenant
   *
   * This callback is called AFTER the tenant is loaded but BEFORE
   * granting access. Use it to verify the user actually belongs
   * to the tenant they're trying to access.
   *
   * This prevents tenant isolation bypass attacks where a user
   * might manipulate JWT claims to access another tenant's data.
   *
   * @param ctx - The request context containing user info
   * @param tenant - The loaded tenant entity
   * @returns true if access is allowed, false to deny
   *
   * @example
   * ```typescript
   * verifyTenantAccess: async (ctx, tenant) => {
   *   // Check user's tenant memberships in database
   *   const membership = await publicDb.tenantMember.findFirst({
   *     where: { userId: ctx.user?.id, tenantId: tenant.id }
   *   });
   *   return membership !== null;
   * }
   * ```
   */
  verifyTenantAccess?: (ctx: TenantContextInput, tenant: Tenant) => Promise<boolean> | boolean;
}

/**
 * Input context for tenant middleware (before tenant is resolved)
 */
export interface TenantContextInput {
  /** User from auth middleware */
  user?: { id: string; [key: string]: unknown };
  /** Auth context with JWT token */
  auth?: {
    token?: {
      tenantId?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Context extension added by tenant middleware
 */
export interface TenantContext<TClient extends DatabaseClient> {
  /** Current tenant info */
  tenant: Tenant;
  /** Tenant-scoped database client */
  db: TClient;
  /** Public schema client (if configured) */
  publicDb?: TClient;
}

// ============================================================================
// Schema Manager Configuration
// ============================================================================

/**
 * Configuration for tenant schema manager
 */
export interface TenantSchemaManagerConfig {
  /**
   * Database URL for executing schema DDL
   */
  databaseUrl: string;

  /**
   * Prefix for tenant schema names
   * @default 'tenant_'
   */
  schemaPrefix?: string;

  /**
   * Path to Prisma schema file for migrations
   * @default './prisma/schema.prisma'
   */
  prismaSchemaPath?: string;
}

/**
 * Result of schema creation
 */
export interface SchemaCreateResult {
  /** The created schema name */
  schemaName: string;
  /** Whether the schema was newly created (false if already existed) */
  created: boolean;
}

/**
 * Result of schema migration
 */
export interface SchemaMigrateResult {
  /** The migrated schema name */
  schemaName: string;
  /** Number of migrations applied */
  migrationsApplied: number;
}

// ============================================================================
// Provisioner Configuration
// ============================================================================

/**
 * Extended database client interface for tenant operations
 *
 * This interface defines the Prisma-specific methods needed by the provisioner.
 * It allows type-safe access to tenant CRUD operations without unsafe inline casting.
 *
 * @example
 * ```typescript
 * // Your Prisma client already satisfies this interface if you have a 'tenant' model
 * const provisioner = createTenantProvisioner({
 *   schemaManager,
 *   publicClient: prismaClient as TenantDatabaseClient,
 *   clientPool,
 * });
 * ```
 */
export interface TenantDatabaseClient extends DatabaseClient {
  /**
   * Prisma model delegate for tenant operations (optional)
   * If not available, falls back to raw queries
   */
  tenant?: {
    findUnique: (args: { where: { id?: string; slug?: string } }) => Promise<Tenant | null>;
    findMany: (args?: { where?: { status?: TenantStatus } }) => Promise<Tenant[]>;
    create: (args: {
      data: { slug: string; name: string; schemaName: string; status: TenantStatus };
    }) => Promise<Tenant>;
    update: (args: {
      where: { id: string };
      data: { status?: TenantStatus; updatedAt?: Date };
    }) => Promise<Tenant>;
    delete: (args: { where: { id: string } }) => Promise<Tenant>;
  };

  /**
   * Prisma raw query execution (fallback when model delegate unavailable)
   */
  $queryRaw?: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;

  /**
   * Prisma raw execute for INSERT/UPDATE/DELETE
   */
  $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
}

/**
 * Configuration for tenant provisioner
 */
export interface TenantProvisionerConfig<TClient extends DatabaseClient> {
  /** Schema manager for DDL operations */
  schemaManager: TenantSchemaManager;

  /**
   * Public schema client for creating tenant records
   *
   * Must implement TenantDatabaseClient interface with either:
   * - `tenant` model delegate (Prisma with tenant model)
   * - `$queryRaw` and `$executeRaw` methods (raw query fallback)
   */
  publicClient: TClient & Partial<TenantDatabaseClient>;

  /** Client pool for testing new tenant connections */
  clientPool: TenantClientPool<TClient>;
}

/**
 * Input for provisioning a new tenant
 */
export interface TenantProvisionInput {
  /** URL-safe slug (will be sanitized) */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Optional: Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of tenant provisioning
 */
export interface TenantProvisionResult {
  /** The created tenant */
  tenant: Tenant;
  /** Whether schema was newly created */
  schemaCreated: boolean;
  /** Number of migrations applied */
  migrationsApplied: number;
}

// ============================================================================
// Interfaces (for implementations)
// ============================================================================

/**
 * Interface for tenant client pool
 */
export interface TenantClientPool<TClient extends DatabaseClient> {
  /**
   * Get or create a client for a tenant schema
   */
  getClient(schemaName: string): Promise<TClient>;

  /**
   * Release a client back to the pool
   */
  releaseClient(schemaName: string): void;

  /**
   * Check if a client exists in the pool without creating it
   * Useful for health checks
   */
  hasClient(schemaName: string): boolean;

  /**
   * Disconnect all clients and clear the pool
   *
   * IMPORTANT: This also stops the cleanup timer.
   * Always call this method during application shutdown.
   */
  disconnectAll(): Promise<void>;

  /**
   * Stop the cleanup timer without disconnecting clients
   *
   * Use this when you need to stop the timer but keep clients connected.
   * For full cleanup, use `disconnectAll()` instead.
   */
  close(): void;

  /**
   * Get current pool statistics
   */
  getStats(): TenantPoolStats;
}

/**
 * Pool statistics
 */
export interface TenantPoolStats {
  /** Number of active clients */
  activeClients: number;
  /** Maximum allowed clients */
  maxClients: number;
  /** Total clients created since pool initialization */
  totalCreated: number;
  /** Total clients evicted due to idle timeout */
  totalEvicted: number;
}

/**
 * Interface for tenant schema manager
 */
export interface TenantSchemaManager {
  /**
   * Create a new PostgreSQL schema
   */
  createSchema(slug: string): Promise<SchemaCreateResult>;

  /**
   * Run Prisma migrations on a schema
   */
  migrateSchema(schemaName: string): Promise<SchemaMigrateResult>;

  /**
   * Delete a schema (DANGEROUS - drops all data)
   */
  deleteSchema(schemaName: string): Promise<void>;

  /**
   * List all tenant schemas
   */
  listSchemas(): Promise<string[]>;

  /**
   * Check if a schema exists
   */
  schemaExists(schemaName: string): Promise<boolean>;
}

/**
 * Interface for tenant provisioner
 */
export interface TenantProvisioner {
  /**
   * Provision a new tenant (create record + schema + migrate)
   */
  provision(input: TenantProvisionInput): Promise<TenantProvisionResult>;

  /**
   * Deprovision a tenant (delete schema + record)
   */
  deprovision(tenantId: string): Promise<void>;

  /**
   * Migrate all tenant schemas
   */
  migrateAll(): Promise<SchemaMigrateResult[]>;
}

// ============================================================================
// Declaration Merging
// ============================================================================

/**
 * Extend @veloxts/core BaseContext with tenant fields
 *
 * Users should add this to their project:
 * ```typescript
 * declare module '@veloxts/core' {
 *   interface BaseContext {
 *     tenant?: Tenant;
 *     db: PrismaClient;
 *     publicDb?: PrismaClient;
 *   }
 * }
 * ```
 */

/**
 * Extend @veloxts/auth TokenPayload with tenantId
 *
 * Users should add this to their project:
 * ```typescript
 * declare module '@veloxts/auth' {
 *   interface TokenPayload {
 *     tenantId?: string;
 *   }
 * }
 * ```
 */
