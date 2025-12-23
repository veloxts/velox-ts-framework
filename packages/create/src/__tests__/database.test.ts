/**
 * Database Type Integration Tests
 *
 * Tests that the template system correctly generates database-specific files
 * for SQLite and PostgreSQL configurations.
 */

import { describe, expect, it } from 'vitest';

import { compileTemplate } from '../templates/compiler.js';
import {
  applyDatabaseDependencies,
  applyPlaceholders,
  processConditionals,
} from '../templates/placeholders.js';
import type { TemplateConfig } from '../templates/types.js';

// ============================================================================
// Test Configurations
// ============================================================================

const sqliteConfig: TemplateConfig = {
  projectName: 'test-app',
  packageManager: 'pnpm',
  template: 'spa',
  database: 'sqlite',
};

const postgresConfig: TemplateConfig = {
  projectName: 'test-app',
  packageManager: 'pnpm',
  template: 'spa',
  database: 'postgresql',
};

// ============================================================================
// Placeholder Tests
// ============================================================================

describe('Database Placeholders', () => {
  describe('DATABASE_PROVIDER placeholder', () => {
    it('should replace with sqlite for sqlite config', () => {
      const content = 'provider = "__DATABASE_PROVIDER__"';
      const result = applyPlaceholders(content, sqliteConfig);
      expect(result).toBe('provider = "sqlite"');
    });

    it('should replace with postgresql for postgres config', () => {
      const content = 'provider = "__DATABASE_PROVIDER__"';
      const result = applyPlaceholders(content, postgresConfig);
      expect(result).toBe('provider = "postgresql"');
    });
  });

  describe('DATABASE_URL placeholder', () => {
    it('should use file URL for sqlite', () => {
      const content = 'DATABASE_URL="__DATABASE_URL__"';
      const result = applyPlaceholders(content, sqliteConfig);
      expect(result).toBe('DATABASE_URL="file:./dev.db"');
    });

    it('should use postgresql URL for postgres', () => {
      const content = 'DATABASE_URL="__DATABASE_URL__"';
      const result = applyPlaceholders(content, postgresConfig);
      expect(result).toBe('DATABASE_URL="postgresql://user:password@localhost:5432/myapp"');
    });
  });
});

// ============================================================================
// Conditional Block Tests
// ============================================================================

describe('Database Conditional Blocks', () => {
  const contentWithConditionals = `
/* @if sqlite */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
/* @endif sqlite */
/* @if postgresql */
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
/* @endif postgresql */
`;

  it('should keep sqlite block and remove postgresql for sqlite config', () => {
    const result = processConditionals(contentWithConditionals, sqliteConfig);
    expect(result).toContain('PrismaBetterSqlite3');
    expect(result).not.toContain('PrismaPg');
    expect(result).not.toContain('Pool');
  });

  it('should keep postgresql block and remove sqlite for postgres config', () => {
    const result = processConditionals(contentWithConditionals, postgresConfig);
    expect(result).not.toContain('PrismaBetterSqlite3');
    expect(result).toContain('PrismaPg');
    expect(result).toContain('Pool');
  });

  it('should remove conditional markers but keep content for matching database', () => {
    const result = processConditionals(contentWithConditionals, sqliteConfig);
    expect(result).not.toContain('/* @if sqlite */');
    expect(result).not.toContain('/* @endif sqlite */');
  });
});

// ============================================================================
// Package.json Dependency Tests
// ============================================================================

describe('Database Dependencies', () => {
  const basePackageJson = JSON.stringify(
    {
      name: 'test-api',
      dependencies: {
        '@prisma/adapter-better-sqlite3': '7.2.0',
        '@prisma/client': '7.2.0',
        'better-sqlite3': '12.5.0',
        zod: '3.25.76',
      },
      devDependencies: {
        '@types/node': '25.0.0',
        prisma: '7.2.0',
      },
    },
    null,
    2
  );

  it('should keep sqlite dependencies for sqlite config', () => {
    const result = applyDatabaseDependencies(basePackageJson, sqliteConfig);
    const pkg = JSON.parse(result);

    expect(pkg.dependencies['@prisma/adapter-better-sqlite3']).toBe('7.2.0');
    expect(pkg.dependencies['better-sqlite3']).toBe('12.5.0');
    expect(pkg.dependencies['@prisma/adapter-pg']).toBeUndefined();
    expect(pkg.dependencies.pg).toBeUndefined();
  });

  it('should swap to postgresql dependencies for postgres config', () => {
    const result = applyDatabaseDependencies(basePackageJson, postgresConfig);
    const pkg = JSON.parse(result);

    expect(pkg.dependencies['@prisma/adapter-better-sqlite3']).toBeUndefined();
    expect(pkg.dependencies['better-sqlite3']).toBeUndefined();
    expect(pkg.dependencies['@prisma/adapter-pg']).toBe('7.2.0');
    expect(pkg.dependencies.pg).toBe('8.16.0');
  });

  it('should add @types/pg to devDependencies for postgres config', () => {
    const result = applyDatabaseDependencies(basePackageJson, postgresConfig);
    const pkg = JSON.parse(result);

    expect(pkg.devDependencies['@types/pg']).toBe('8.16.0');
  });

  it('should preserve other dependencies', () => {
    const result = applyDatabaseDependencies(basePackageJson, postgresConfig);
    const pkg = JSON.parse(result);

    expect(pkg.dependencies['@prisma/client']).toBe('7.2.0');
    expect(pkg.dependencies.zod).toBe('3.25.76');
    expect(pkg.devDependencies.prisma).toBe('7.2.0');
  });

  it('should sort dependencies alphabetically', () => {
    const result = applyDatabaseDependencies(basePackageJson, postgresConfig);
    const pkg = JSON.parse(result);

    const depKeys = Object.keys(pkg.dependencies);
    const sortedDepKeys = [...depKeys].sort((a, b) => a.localeCompare(b));
    expect(depKeys).toEqual(sortedDepKeys);
  });
});

// ============================================================================
// Template Compilation Integration Tests
// ============================================================================

describe('Template Compilation', () => {
  describe('schema.prisma', () => {
    it('should compile with sqlite provider', () => {
      const result = compileTemplate('api/prisma/schema.default.prisma', sqliteConfig);
      expect(result).toContain('provider = "sqlite"');
      expect(result).not.toContain('__DATABASE_PROVIDER__');
    });

    it('should compile with postgresql provider', () => {
      const result = compileTemplate('api/prisma/schema.default.prisma', postgresConfig);
      expect(result).toContain('provider = "postgresql"');
      expect(result).not.toContain('__DATABASE_PROVIDER__');
    });
  });

  describe('database.ts', () => {
    it('should compile with SQLite adapter for sqlite config', () => {
      const result = compileTemplate('api/config/database.ts', sqliteConfig);
      expect(result).toContain('PrismaBetterSqlite3');
      expect(result).toContain("'@prisma/adapter-better-sqlite3'");
      expect(result).not.toContain('PrismaPg');
      expect(result).not.toContain("'@prisma/adapter-pg'");
    });

    it('should compile with PostgreSQL adapter for postgres config', () => {
      const result = compileTemplate('api/config/database.ts', postgresConfig);
      expect(result).toContain('PrismaPg');
      expect(result).toContain("'@prisma/adapter-pg'");
      expect(result).toContain('Pool');
      expect(result).not.toContain('PrismaBetterSqlite3');
      expect(result).not.toContain("'@prisma/adapter-better-sqlite3'");
    });

    it('should include graceful shutdown for PostgreSQL', () => {
      const result = compileTemplate('api/config/database.ts', postgresConfig);
      expect(result).toContain('shutdown');
      expect(result).toContain('pool.end()');
      expect(result).toContain('SIGTERM');
    });

    it('should not include pool shutdown for SQLite', () => {
      const result = compileTemplate('api/config/database.ts', sqliteConfig);
      expect(result).not.toContain('pool.end()');
    });
  });

  describe('.env files', () => {
    it('should compile with SQLite DATABASE_URL', () => {
      const result = compileTemplate('api/env.default', sqliteConfig);
      expect(result).toContain('DATABASE_URL="file:./dev.db"');
    });

    it('should compile with PostgreSQL DATABASE_URL', () => {
      const result = compileTemplate('api/env.default', postgresConfig);
      expect(result).toContain('DATABASE_URL="postgresql://user:password@localhost:5432/myapp"');
    });
  });
});

// ============================================================================
// RSC Template Tests
// ============================================================================

describe('RSC Template Database Support', () => {
  const rscSqliteConfig: TemplateConfig = {
    ...sqliteConfig,
    template: 'rsc',
  };

  const rscPostgresConfig: TemplateConfig = {
    ...postgresConfig,
    template: 'rsc',
  };

  describe('RSC schema.prisma', () => {
    it('should compile with sqlite provider', () => {
      const result = compileTemplate('rsc/prisma/schema.prisma', rscSqliteConfig);
      expect(result).toContain('provider = "sqlite"');
    });

    it('should compile with postgresql provider', () => {
      const result = compileTemplate('rsc/prisma/schema.prisma', rscPostgresConfig);
      expect(result).toContain('provider = "postgresql"');
    });
  });

  describe('RSC database.ts', () => {
    it('should compile with SQLite adapter for sqlite config', () => {
      const result = compileTemplate('rsc/src/api/database.ts', rscSqliteConfig);
      expect(result).toContain('PrismaBetterSqlite3');
      expect(result).not.toContain('PrismaPg');
    });

    it('should compile with PostgreSQL adapter for postgres config', () => {
      const result = compileTemplate('rsc/src/api/database.ts', rscPostgresConfig);
      expect(result).toContain('PrismaPg');
      expect(result).toContain('Pool');
      expect(result).not.toContain('PrismaBetterSqlite3');
    });

    it('should include dotenv loading for Vite SSR compatibility', () => {
      const result = compileTemplate('rsc/src/api/database.ts', rscPostgresConfig);
      expect(result).toContain('dotenv');
      expect(result).toContain('projectRoot');
    });
  });

  describe('RSC .env', () => {
    it('should compile with SQLite DATABASE_URL', () => {
      const result = compileTemplate('rsc/env.example', rscSqliteConfig);
      expect(result).toContain('DATABASE_URL="file:./dev.db"');
    });

    it('should compile with PostgreSQL DATABASE_URL', () => {
      const result = compileTemplate('rsc/env.example', rscPostgresConfig);
      expect(result).toContain('DATABASE_URL="postgresql://user:password@localhost:5432/myapp"');
    });
  });
});

// ============================================================================
// Auth Template Tests
// ============================================================================

describe('Auth Template Database Support', () => {
  const authSqliteConfig: TemplateConfig = {
    ...sqliteConfig,
    template: 'auth',
  };

  const authPostgresConfig: TemplateConfig = {
    ...postgresConfig,
    template: 'auth',
  };

  describe('Auth schema.prisma', () => {
    it('should compile with sqlite provider', () => {
      const result = compileTemplate('api/prisma/schema.auth.prisma', authSqliteConfig);
      expect(result).toContain('provider = "sqlite"');
    });

    it('should compile with postgresql provider', () => {
      const result = compileTemplate('api/prisma/schema.auth.prisma', authPostgresConfig);
      expect(result).toContain('provider = "postgresql"');
    });

    it('should include password field for auth', () => {
      const result = compileTemplate('api/prisma/schema.auth.prisma', authSqliteConfig);
      expect(result).toContain('password');
    });
  });

  describe('Auth .env', () => {
    it('should include JWT secrets', () => {
      const result = compileTemplate('api/env.auth', authSqliteConfig);
      expect(result).toContain('JWT_SECRET');
      expect(result).toContain('JWT_REFRESH_SECRET');
    });

    it('should use correct DATABASE_URL for postgres', () => {
      const result = compileTemplate('api/env.auth', authPostgresConfig);
      expect(result).toContain('DATABASE_URL="postgresql://user:password@localhost:5432/myapp"');
    });
  });
});
