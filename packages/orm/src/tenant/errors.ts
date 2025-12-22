/**
 * Tenant-specific error classes for @veloxts/orm/tenant
 */

/**
 * Base error class for tenant-related errors
 */
export class TenantError extends Error {
  public readonly code: TenantErrorCode;
  public readonly tenantId?: string;
  public readonly schemaName?: string;

  constructor(
    message: string,
    code: TenantErrorCode,
    options?: {
      tenantId?: string;
      schemaName?: string;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'TenantError';
    this.code = code;
    this.tenantId = options?.tenantId;
    this.schemaName = options?.schemaName;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TenantError);
    }
  }
}

/**
 * Error codes for tenant operations
 */
export type TenantErrorCode =
  | 'TENANT_NOT_FOUND'
  | 'TENANT_SUSPENDED'
  | 'TENANT_PENDING'
  | 'TENANT_MIGRATING'
  | 'TENANT_ID_MISSING'
  | 'TENANT_ACCESS_DENIED'
  | 'SCHEMA_CREATE_FAILED'
  | 'SCHEMA_DELETE_FAILED'
  | 'SCHEMA_MIGRATE_FAILED'
  | 'SCHEMA_NOT_FOUND'
  | 'SCHEMA_ALREADY_EXISTS'
  | 'CLIENT_POOL_EXHAUSTED'
  | 'CLIENT_CREATE_FAILED'
  | 'CLIENT_DISCONNECT_FAILED'
  | 'INVALID_SLUG'
  | 'PROVISION_FAILED'
  | 'DEPROVISION_FAILED';

/**
 * Tenant not found in database
 */
export class TenantNotFoundError extends TenantError {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`, 'TENANT_NOT_FOUND', { tenantId });
    this.name = 'TenantNotFoundError';
  }
}

/**
 * Tenant is suspended and cannot be accessed
 */
export class TenantSuspendedError extends TenantError {
  constructor(tenantId: string) {
    super(`Tenant is suspended: ${tenantId}`, 'TENANT_SUSPENDED', { tenantId });
    this.name = 'TenantSuspendedError';
  }
}

/**
 * Tenant is pending activation
 */
export class TenantPendingError extends TenantError {
  constructor(tenantId: string) {
    super(`Tenant is pending activation: ${tenantId}`, 'TENANT_PENDING', { tenantId });
    this.name = 'TenantPendingError';
  }
}

/**
 * Tenant is currently being migrated
 */
export class TenantMigratingError extends TenantError {
  constructor(tenantId: string) {
    super(`Tenant is currently migrating: ${tenantId}`, 'TENANT_MIGRATING', { tenantId });
    this.name = 'TenantMigratingError';
  }
}

/**
 * Tenant ID missing from request context
 */
export class TenantIdMissingError extends TenantError {
  constructor() {
    super('Tenant ID is required but was not found in request context', 'TENANT_ID_MISSING');
    this.name = 'TenantIdMissingError';
  }
}

/**
 * User does not have access to the requested tenant
 *
 * SECURITY: This error is thrown when tenant access verification fails.
 * It prevents tenant isolation bypass attacks where a user might try
 * to access a tenant they don't belong to by manipulating JWT claims.
 */
export class TenantAccessDeniedError extends TenantError {
  public readonly userId?: string;

  constructor(tenantId: string, userId?: string) {
    super(`Access denied to tenant: ${tenantId}`, 'TENANT_ACCESS_DENIED', { tenantId });
    this.name = 'TenantAccessDeniedError';
    this.userId = userId;
  }
}

/**
 * Schema creation failed
 */
export class SchemaCreateError extends TenantError {
  constructor(schemaName: string, cause?: Error) {
    super(`Failed to create schema: ${schemaName}`, 'SCHEMA_CREATE_FAILED', { schemaName, cause });
    this.name = 'SchemaCreateError';
  }
}

/**
 * Schema deletion failed
 */
export class SchemaDeleteError extends TenantError {
  constructor(schemaName: string, cause?: Error) {
    super(`Failed to delete schema: ${schemaName}`, 'SCHEMA_DELETE_FAILED', { schemaName, cause });
    this.name = 'SchemaDeleteError';
  }
}

/**
 * Schema migration failed
 */
export class SchemaMigrateError extends TenantError {
  constructor(schemaName: string, cause?: Error) {
    super(`Failed to migrate schema: ${schemaName}`, 'SCHEMA_MIGRATE_FAILED', {
      schemaName,
      cause,
    });
    this.name = 'SchemaMigrateError';
  }
}

/**
 * Schema not found
 */
export class SchemaNotFoundError extends TenantError {
  constructor(schemaName: string) {
    super(`Schema not found: ${schemaName}`, 'SCHEMA_NOT_FOUND', { schemaName });
    this.name = 'SchemaNotFoundError';
  }
}

/**
 * Schema already exists
 */
export class SchemaAlreadyExistsError extends TenantError {
  constructor(schemaName: string) {
    super(`Schema already exists: ${schemaName}`, 'SCHEMA_ALREADY_EXISTS', { schemaName });
    this.name = 'SchemaAlreadyExistsError';
  }
}

/**
 * Client pool has reached maximum capacity
 */
export class ClientPoolExhaustedError extends TenantError {
  constructor(maxClients: number) {
    super(`Client pool exhausted: maximum ${maxClients} clients reached`, 'CLIENT_POOL_EXHAUSTED');
    this.name = 'ClientPoolExhaustedError';
  }
}

/**
 * Failed to create database client
 */
export class ClientCreateError extends TenantError {
  constructor(schemaName: string, cause?: Error) {
    super(`Failed to create client for schema: ${schemaName}`, 'CLIENT_CREATE_FAILED', {
      schemaName,
      cause,
    });
    this.name = 'ClientCreateError';
  }
}

/**
 * Failed to disconnect database client
 */
export class ClientDisconnectError extends TenantError {
  constructor(schemaName: string, cause?: Error) {
    super(`Failed to disconnect client for schema: ${schemaName}`, 'CLIENT_DISCONNECT_FAILED', {
      schemaName,
      cause,
    });
    this.name = 'ClientDisconnectError';
  }
}

/**
 * Invalid tenant slug format
 */
export class InvalidSlugError extends TenantError {
  constructor(slug: string, reason: string) {
    super(`Invalid tenant slug '${slug}': ${reason}`, 'INVALID_SLUG');
    this.name = 'InvalidSlugError';
  }
}

/**
 * Tenant provisioning failed
 */
export class ProvisionError extends TenantError {
  constructor(slug: string, cause?: Error) {
    super(`Failed to provision tenant: ${slug}`, 'PROVISION_FAILED', { cause });
    this.name = 'ProvisionError';
  }
}

/**
 * Tenant deprovisioning failed
 */
export class DeprovisionError extends TenantError {
  constructor(tenantId: string, cause?: Error) {
    super(`Failed to deprovision tenant: ${tenantId}`, 'DEPROVISION_FAILED', { tenantId, cause });
    this.name = 'DeprovisionError';
  }
}

/**
 * Type guard to check if an error is a TenantError
 */
export function isTenantError(error: unknown): error is TenantError {
  return error instanceof TenantError;
}

/**
 * Get error based on tenant status
 */
export function getTenantStatusError(tenantId: string, status: string): TenantError | null {
  switch (status) {
    case 'suspended':
      return new TenantSuspendedError(tenantId);
    case 'pending':
      return new TenantPendingError(tenantId);
    case 'migrating':
      return new TenantMigratingError(tenantId);
    default:
      return null;
  }
}
