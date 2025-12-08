/**
 * Prisma Wrapper - Unit Tests
 *
 * Tests for Prisma CLI execution and output parsing.
 */

import { describe, it, expect } from 'vitest';

import { parseMigrateStatusOutput } from '../prisma-wrapper.js';

describe('Prisma Wrapper', () => {
  describe('parseMigrateStatusOutput', () => {
    it('should parse applied migrations', () => {
      const output = `
Database connection string: postgresql://...

3 migrations found in prisma/migrations

The following migration have been applied:

20241207120000_create_users
20241208120000_add_email

All migrations have been applied.
`;

      const result = parseMigrateStatusOutput(output);

      expect(result.applied).toContain('20241207120000_create_users');
      expect(result.applied).toContain('20241208120000_add_email');
      expect(result.pending).toHaveLength(0);
      expect(result.inSync).toBe(true);
    });

    it('should parse pending migrations', () => {
      const output = `
Database connection string: postgresql://...

3 migrations found in prisma/migrations

The following migration have been applied:

20241207120000_create_users

The following migrations have not yet applied:

20241208120000_add_email
20241209120000_add_status
`;

      const result = parseMigrateStatusOutput(output);

      expect(result.applied).toContain('20241207120000_create_users');
      expect(result.pending).toContain('20241208120000_add_email');
      expect(result.pending).toContain('20241209120000_add_status');
      expect(result.inSync).toBe(false);
    });

    it('should detect warnings', () => {
      const output = `
Warning: Some warning message

Database connection string: postgresql://...
`;

      const result = parseMigrateStatusOutput(output);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Warning');
    });

    it('should handle empty output', () => {
      const result = parseMigrateStatusOutput('');

      expect(result.applied).toHaveLength(0);
      expect(result.pending).toHaveLength(0);
      expect(result.inSync).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle output with no migrations', () => {
      const output = `
Database connection string: postgresql://...

No migrations found in prisma/migrations
`;

      const result = parseMigrateStatusOutput(output);

      expect(result.applied).toHaveLength(0);
      expect(result.pending).toHaveLength(0);
      expect(result.inSync).toBe(true);
    });

    it('should parse migrations with underscores in description', () => {
      const output = `
The following migration have been applied:

20241207120000_create_user_profiles
20241208120000_add_user_email_verification
`;

      const result = parseMigrateStatusOutput(output);

      expect(result.applied).toContain('20241207120000_create_user_profiles');
      expect(result.applied).toContain('20241208120000_add_user_email_verification');
    });
  });
});
