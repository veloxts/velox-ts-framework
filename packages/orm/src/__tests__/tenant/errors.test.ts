import { describe, expect, it } from 'vitest';
import {
  TenantError,
  TenantNotFoundError,
  TenantSuspendedError,
  TenantPendingError,
  TenantMigratingError,
  TenantIdMissingError,
  SchemaCreateError,
  SchemaDeleteError,
  SchemaMigrateError,
  SchemaNotFoundError,
  SchemaAlreadyExistsError,
  ClientPoolExhaustedError,
  ClientCreateError,
  ClientDisconnectError,
  InvalidSlugError,
  ProvisionError,
  DeprovisionError,
  isTenantError,
  getTenantStatusError,
} from '../../tenant/errors.js';

describe('tenant/errors', () => {
  describe('TenantError', () => {
    it('should create base tenant error', () => {
      const error = new TenantError('Test error', 'TENANT_NOT_FOUND');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TenantError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TENANT_NOT_FOUND');
    });

    it('should include tenantId when provided', () => {
      const error = new TenantError('Test', 'TENANT_NOT_FOUND', {
        tenantId: 'test-123',
      });

      expect(error.tenantId).toBe('test-123');
    });

    it('should include schemaName when provided', () => {
      const error = new TenantError('Test', 'SCHEMA_CREATE_FAILED', {
        schemaName: 'tenant_acme',
      });

      expect(error.schemaName).toBe('tenant_acme');
    });

    it('should include cause when provided', () => {
      const cause = new Error('Root cause');
      const error = new TenantError('Test', 'TENANT_NOT_FOUND', { cause });

      expect(error.cause).toBe(cause);
    });
  });

  describe('Tenant status errors', () => {
    it('TenantNotFoundError should have correct properties', () => {
      const error = new TenantNotFoundError('tenant-123');

      expect(error.name).toBe('TenantNotFoundError');
      expect(error.code).toBe('TENANT_NOT_FOUND');
      expect(error.tenantId).toBe('tenant-123');
      expect(error.message).toContain('tenant-123');
    });

    it('TenantSuspendedError should have correct properties', () => {
      const error = new TenantSuspendedError('tenant-123');

      expect(error.name).toBe('TenantSuspendedError');
      expect(error.code).toBe('TENANT_SUSPENDED');
      expect(error.tenantId).toBe('tenant-123');
    });

    it('TenantPendingError should have correct properties', () => {
      const error = new TenantPendingError('tenant-123');

      expect(error.name).toBe('TenantPendingError');
      expect(error.code).toBe('TENANT_PENDING');
      expect(error.tenantId).toBe('tenant-123');
    });

    it('TenantMigratingError should have correct properties', () => {
      const error = new TenantMigratingError('tenant-123');

      expect(error.name).toBe('TenantMigratingError');
      expect(error.code).toBe('TENANT_MIGRATING');
      expect(error.tenantId).toBe('tenant-123');
    });

    it('TenantIdMissingError should have correct properties', () => {
      const error = new TenantIdMissingError();

      expect(error.name).toBe('TenantIdMissingError');
      expect(error.code).toBe('TENANT_ID_MISSING');
      expect(error.message).toContain('required');
    });
  });

  describe('Schema errors', () => {
    it('SchemaCreateError should include schema name and cause', () => {
      const cause = new Error('SQL error');
      const error = new SchemaCreateError('tenant_acme', cause);

      expect(error.name).toBe('SchemaCreateError');
      expect(error.code).toBe('SCHEMA_CREATE_FAILED');
      expect(error.schemaName).toBe('tenant_acme');
      expect(error.cause).toBe(cause);
    });

    it('SchemaDeleteError should include schema name and cause', () => {
      const error = new SchemaDeleteError('tenant_acme');

      expect(error.name).toBe('SchemaDeleteError');
      expect(error.code).toBe('SCHEMA_DELETE_FAILED');
      expect(error.schemaName).toBe('tenant_acme');
    });

    it('SchemaMigrateError should include schema name', () => {
      const error = new SchemaMigrateError('tenant_acme');

      expect(error.name).toBe('SchemaMigrateError');
      expect(error.code).toBe('SCHEMA_MIGRATE_FAILED');
      expect(error.schemaName).toBe('tenant_acme');
    });

    it('SchemaNotFoundError should include schema name', () => {
      const error = new SchemaNotFoundError('tenant_acme');

      expect(error.name).toBe('SchemaNotFoundError');
      expect(error.code).toBe('SCHEMA_NOT_FOUND');
      expect(error.schemaName).toBe('tenant_acme');
    });

    it('SchemaAlreadyExistsError should include schema name', () => {
      const error = new SchemaAlreadyExistsError('tenant_acme');

      expect(error.name).toBe('SchemaAlreadyExistsError');
      expect(error.code).toBe('SCHEMA_ALREADY_EXISTS');
      expect(error.schemaName).toBe('tenant_acme');
    });
  });

  describe('Client pool errors', () => {
    it('ClientPoolExhaustedError should include max clients', () => {
      const error = new ClientPoolExhaustedError(50);

      expect(error.name).toBe('ClientPoolExhaustedError');
      expect(error.code).toBe('CLIENT_POOL_EXHAUSTED');
      expect(error.message).toContain('50');
    });

    it('ClientCreateError should include schema name', () => {
      const error = new ClientCreateError('tenant_acme');

      expect(error.name).toBe('ClientCreateError');
      expect(error.code).toBe('CLIENT_CREATE_FAILED');
      expect(error.schemaName).toBe('tenant_acme');
    });

    it('ClientDisconnectError should include schema name', () => {
      const error = new ClientDisconnectError('tenant_acme');

      expect(error.name).toBe('ClientDisconnectError');
      expect(error.code).toBe('CLIENT_DISCONNECT_FAILED');
      expect(error.schemaName).toBe('tenant_acme');
    });
  });

  describe('Validation errors', () => {
    it('InvalidSlugError should include slug and reason', () => {
      const error = new InvalidSlugError('bad slug!', 'contains invalid characters');

      expect(error.name).toBe('InvalidSlugError');
      expect(error.code).toBe('INVALID_SLUG');
      expect(error.message).toContain('bad slug!');
      expect(error.message).toContain('contains invalid characters');
    });
  });

  describe('Provisioning errors', () => {
    it('ProvisionError should include slug', () => {
      const error = new ProvisionError('acme-corp');

      expect(error.name).toBe('ProvisionError');
      expect(error.code).toBe('PROVISION_FAILED');
      expect(error.message).toContain('acme-corp');
    });

    it('DeprovisionError should include tenant ID', () => {
      const error = new DeprovisionError('tenant-123');

      expect(error.name).toBe('DeprovisionError');
      expect(error.code).toBe('DEPROVISION_FAILED');
      expect(error.tenantId).toBe('tenant-123');
    });
  });

  describe('isTenantError', () => {
    it('should return true for TenantError', () => {
      const error = new TenantError('Test', 'TENANT_NOT_FOUND');
      expect(isTenantError(error)).toBe(true);
    });

    it('should return true for subclasses', () => {
      expect(isTenantError(new TenantNotFoundError('x'))).toBe(true);
      expect(isTenantError(new SchemaCreateError('x'))).toBe(true);
      expect(isTenantError(new ClientPoolExhaustedError(50))).toBe(true);
    });

    it('should return false for regular Error', () => {
      expect(isTenantError(new Error('test'))).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(isTenantError(null)).toBe(false);
      expect(isTenantError(undefined)).toBe(false);
      expect(isTenantError('error')).toBe(false);
      expect(isTenantError({ code: 'TENANT_NOT_FOUND' })).toBe(false);
    });
  });

  describe('getTenantStatusError', () => {
    it('should return TenantSuspendedError for suspended status', () => {
      const error = getTenantStatusError('t-123', 'suspended');

      expect(error).toBeInstanceOf(TenantSuspendedError);
      expect(error?.tenantId).toBe('t-123');
    });

    it('should return TenantPendingError for pending status', () => {
      const error = getTenantStatusError('t-123', 'pending');

      expect(error).toBeInstanceOf(TenantPendingError);
    });

    it('should return TenantMigratingError for migrating status', () => {
      const error = getTenantStatusError('t-123', 'migrating');

      expect(error).toBeInstanceOf(TenantMigratingError);
    });

    it('should return null for active status', () => {
      const error = getTenantStatusError('t-123', 'active');

      expect(error).toBeNull();
    });

    it('should return null for unknown status', () => {
      const error = getTenantStatusError('t-123', 'unknown');

      expect(error).toBeNull();
    });
  });
});
