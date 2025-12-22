import { describe, expect, it } from 'vitest';

import { InvalidSlugError, SchemaListError, slugToSchemaName } from '../../tenant/index.js';

/**
 * Unit tests for tenant schema manager
 *
 * Note: Full integration tests require a real PostgreSQL database.
 * These tests focus on validation logic and utility functions.
 */

describe('tenant/schema-manager', () => {
  describe('slugToSchemaName', () => {
    it('should convert slug to schema name with default prefix', () => {
      expect(slugToSchemaName('acme-corp')).toBe('tenant_acme_corp');
    });

    it('should convert hyphens to underscores', () => {
      expect(slugToSchemaName('my-company-name')).toBe('tenant_my_company_name');
    });

    it('should convert to lowercase', () => {
      expect(slugToSchemaName('AcmeCorp')).toBe('tenant_acmecorp');
    });

    it('should remove invalid characters', () => {
      expect(slugToSchemaName('acme.corp')).toBe('tenant_acmecorp');
      expect(slugToSchemaName('acme@corp')).toBe('tenant_acmecorp');
    });

    it('should use custom prefix', () => {
      expect(slugToSchemaName('acme', 'org_')).toBe('org_acme');
    });

    it('should handle slugs starting with numbers', () => {
      expect(slugToSchemaName('123company')).toBe('tenant__123company');
    });

    it('should handle single character slugs', () => {
      expect(slugToSchemaName('a')).toBe('tenant_a');
    });

    it('should handle empty prefix', () => {
      expect(slugToSchemaName('acme', '')).toBe('acme');
    });
  });

  describe('InvalidSlugError', () => {
    it('should include slug in error message', () => {
      const error = new InvalidSlugError('bad slug!', 'contains invalid characters');
      expect(error.message).toContain('bad slug!');
      expect(error.message).toContain('contains invalid characters');
    });

    it('should have correct error code', () => {
      const error = new InvalidSlugError('test', 'test reason');
      expect(error.code).toBe('INVALID_SLUG');
    });

    it('should have correct name', () => {
      const error = new InvalidSlugError('test', 'test reason');
      expect(error.name).toBe('InvalidSlugError');
    });
  });

  describe('SchemaListError', () => {
    it('should wrap cause error', () => {
      const cause = new Error('Connection failed');
      const error = new SchemaListError(cause);
      expect(error.cause).toBe(cause);
    });

    it('should have correct error code', () => {
      const error = new SchemaListError();
      expect(error.code).toBe('SCHEMA_LIST_FAILED');
    });

    it('should have descriptive message', () => {
      const error = new SchemaListError();
      expect(error.message).toBe('Failed to list schemas');
    });
  });

  describe('slug validation patterns', () => {
    // These patterns are validated in the schema manager
    const VALID_SLUGS = ['a', 'ab', 'abc', 'acme-corp', 'my-company-123', '123', 'a1', '1a'];

    const _INVALID_SLUGS = [
      '', // empty
      '-acme', // starts with hyphen
      'acme-', // ends with hyphen
      'acme--corp', // double hyphen (valid for regex but not recommended)
      'UPPERCASE', // uppercase (valid but converted)
    ];

    it.each(VALID_SLUGS)('should accept valid slug: %s', (slug) => {
      // Valid slugs should produce valid schema names
      const schemaName = slugToSchemaName(slug);
      expect(schemaName).toMatch(/^tenant_[a-z0-9_]+$/);
    });

    it('should handle edge cases', () => {
      // Very long slug
      const longSlug = 'a'.repeat(50);
      const schemaName = slugToSchemaName(longSlug);
      expect(schemaName.length).toBe(50 + 'tenant_'.length);
    });
  });

  describe('schema name generation security', () => {
    it('should not allow SQL injection via slug', () => {
      const maliciousSlug = "'; DROP TABLE users; --";
      const schemaName = slugToSchemaName(maliciousSlug);
      // All dangerous characters should be stripped
      expect(schemaName).not.toContain("'");
      expect(schemaName).not.toContain(';');
      expect(schemaName).not.toContain('-');
      // The sanitization process converts to lowercase, removes invalid chars
      // and prepends underscore for leading invalid chars
      expect(schemaName).toMatch(/^tenant_[a-z0-9_]+$/);
    });

    it('should not allow path traversal via slug', () => {
      const maliciousSlug = '../../../etc/passwd';
      const schemaName = slugToSchemaName(maliciousSlug);
      expect(schemaName).not.toContain('..');
      expect(schemaName).not.toContain('/');
      expect(schemaName).toBe('tenant_etcpasswd');
    });

    it('should strip null bytes', () => {
      const maliciousSlug = 'acme\x00corp';
      const schemaName = slugToSchemaName(maliciousSlug);
      expect(schemaName).not.toContain('\x00');
    });
  });
});
