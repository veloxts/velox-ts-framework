/**
 * Template System Unit Tests
 *
 * Tests for template validation, generation, and directory structure.
 */

import { describe, expect, it } from 'vitest';

import {
  DATABASE_METADATA,
  generateTemplateFiles,
  getAvailableDatabases,
  getAvailableTemplates,
  getTemplateDirectories,
  isDatabaseAvailable,
  isValidDatabase,
  isValidTemplate,
  TEMPLATE_METADATA,
  type TemplateConfig,
  type TemplateType,
} from '../templates/index.js';
import { resolveTemplateAlias, TEMPLATE_ALIASES } from '../templates/types.js';

// ============================================================================
// Template Validation Tests
// ============================================================================

describe('Template Validation', () => {
  describe('isValidTemplate', () => {
    it('should return true for valid template types', () => {
      expect(isValidTemplate('spa')).toBe(true);
      expect(isValidTemplate('auth')).toBe(true);
      expect(isValidTemplate('trpc')).toBe(true);
      expect(isValidTemplate('rsc')).toBe(true);
      expect(isValidTemplate('rsc-auth')).toBe(true);
    });

    it('should return false for invalid template types', () => {
      expect(isValidTemplate('invalid')).toBe(false);
      expect(isValidTemplate('')).toBe(false);
      expect(isValidTemplate('nextjs')).toBe(false);
      expect(isValidTemplate('vue')).toBe(false);
    });

    it('should return false for template aliases (use resolveTemplateAlias instead)', () => {
      // Aliases are NOT valid template types - they must be resolved first
      expect(isValidTemplate('default')).toBe(false);
      expect(isValidTemplate('fullstack')).toBe(false);
    });
  });

  describe('isValidDatabase', () => {
    it('should return true for valid database types', () => {
      expect(isValidDatabase('sqlite')).toBe(true);
      expect(isValidDatabase('postgresql')).toBe(true);
      expect(isValidDatabase('mysql')).toBe(true);
    });

    it('should return false for invalid database types', () => {
      expect(isValidDatabase('mongodb')).toBe(false);
      expect(isValidDatabase('')).toBe(false);
      expect(isValidDatabase('postgres')).toBe(false); // Must use 'postgresql'
    });
  });

  describe('isDatabaseAvailable', () => {
    it('should return true for enabled databases', () => {
      expect(isDatabaseAvailable('sqlite')).toBe(true);
      expect(isDatabaseAvailable('postgresql')).toBe(true);
    });

    it('should return false for disabled databases', () => {
      expect(isDatabaseAvailable('mysql')).toBe(false);
    });
  });

  describe('resolveTemplateAlias', () => {
    it('should resolve known aliases', () => {
      expect(resolveTemplateAlias('default')).toBe('spa');
      expect(resolveTemplateAlias('fullstack')).toBe('rsc');
    });

    it('should return the same value for valid template types', () => {
      expect(resolveTemplateAlias('spa')).toBe('spa');
      expect(resolveTemplateAlias('auth')).toBe('auth');
      expect(resolveTemplateAlias('rsc-auth')).toBe('rsc-auth');
    });

    it('should return undefined for unknown aliases', () => {
      expect(resolveTemplateAlias('unknown')).toBeUndefined();
      expect(resolveTemplateAlias('')).toBeUndefined();
    });
  });
});

// ============================================================================
// Template Registry Tests
// ============================================================================

describe('Template Registry', () => {
  describe('getAvailableTemplates', () => {
    it('should return all 5 templates', () => {
      const templates = getAvailableTemplates();
      expect(templates).toHaveLength(5);
    });

    it('should have correct structure for each template', () => {
      const templates = getAvailableTemplates();

      for (const template of templates) {
        expect(template).toHaveProperty('type');
        expect(template).toHaveProperty('label');
        expect(template).toHaveProperty('description');
        expect(typeof template.type).toBe('string');
        expect(typeof template.label).toBe('string');
        expect(typeof template.description).toBe('string');
      }
    });

    it('should include all expected template types', () => {
      const templates = getAvailableTemplates();
      const types = templates.map((t) => t.type);

      expect(types).toContain('spa');
      expect(types).toContain('auth');
      expect(types).toContain('trpc');
      expect(types).toContain('rsc');
      expect(types).toContain('rsc-auth');
    });
  });

  describe('getAvailableDatabases', () => {
    it('should return all database options', () => {
      const databases = getAvailableDatabases();
      expect(databases.length).toBeGreaterThanOrEqual(2);
    });

    it('should have correct structure for each database', () => {
      const databases = getAvailableDatabases();

      for (const db of databases) {
        expect(db).toHaveProperty('type');
        expect(db).toHaveProperty('label');
        expect(typeof db.type).toBe('string');
        expect(typeof db.label).toBe('string');
      }
    });

    it('should include sqlite and postgresql', () => {
      const databases = getAvailableDatabases();
      const types = databases.map((d) => d.type);

      expect(types).toContain('sqlite');
      expect(types).toContain('postgresql');
    });
  });

  describe('TEMPLATE_METADATA', () => {
    it('should have metadata for all template types', () => {
      const templateTypes: TemplateType[] = ['spa', 'auth', 'trpc', 'rsc', 'rsc-auth'];

      for (const type of templateTypes) {
        expect(TEMPLATE_METADATA[type]).toBeDefined();
        expect(TEMPLATE_METADATA[type].type).toBe(type);
        expect(TEMPLATE_METADATA[type].label).toBeTruthy();
        expect(TEMPLATE_METADATA[type].description).toBeTruthy();
      }
    });
  });

  describe('DATABASE_METADATA', () => {
    it('should have sqlite marked as recommended', () => {
      expect(DATABASE_METADATA.sqlite.hint).toContain('recommended');
    });

    it('should have mysql marked as coming soon', () => {
      expect(DATABASE_METADATA.mysql.disabled).toBe(true);
      expect(DATABASE_METADATA.mysql.hint).toContain('Coming soon');
    });
  });

  describe('TEMPLATE_ALIASES', () => {
    it('should map default to spa', () => {
      expect(TEMPLATE_ALIASES.default).toBe('spa');
    });

    it('should map fullstack to rsc', () => {
      expect(TEMPLATE_ALIASES.fullstack).toBe('rsc');
    });
  });
});

// ============================================================================
// Template Directory Tests
// ============================================================================

describe('getTemplateDirectories', () => {
  describe('RSC templates', () => {
    it('should return flat structure for rsc template', () => {
      const dirs = getTemplateDirectories('rsc');

      // Should include app layer directories
      expect(dirs).toContain('app');
      expect(dirs).toContain('app/pages');
      expect(dirs).toContain('app/layouts');
      expect(dirs).toContain('app/actions');

      // Should include source layer directories
      expect(dirs).toContain('src');
      expect(dirs).toContain('src/api');
      expect(dirs).toContain('src/api/procedures');

      // Should include prisma and public
      expect(dirs).toContain('prisma');
      expect(dirs).toContain('public');

      // Should NOT include monorepo structure
      expect(dirs).not.toContain('apps');
      expect(dirs).not.toContain('apps/api');
    });

    it('should return auth-specific directories for rsc-auth template', () => {
      const dirs = getTemplateDirectories('rsc-auth');

      // Should include auth pages
      expect(dirs).toContain('app/pages/auth');
      expect(dirs).toContain('app/pages/dashboard');

      // Should include utils for auth helpers
      expect(dirs).toContain('src/api/utils');
    });
  });

  describe('Monorepo templates', () => {
    it('should return monorepo structure for spa template', () => {
      const dirs = getTemplateDirectories('spa');

      // Should include monorepo root
      expect(dirs).toContain('apps');

      // Should include API package
      expect(dirs).toContain('apps/api');
      expect(dirs).toContain('apps/api/src');
      expect(dirs).toContain('apps/api/src/procedures');
      expect(dirs).toContain('apps/api/prisma');

      // Should include Web package
      expect(dirs).toContain('apps/web');
      expect(dirs).toContain('apps/web/src');
    });

    it('should use same structure for auth template', () => {
      const authDirs = getTemplateDirectories('auth');
      const spaDirs = getTemplateDirectories('spa');

      // Auth uses same directory structure as spa
      expect(authDirs).toEqual(spaDirs);
    });

    it('should use same structure for trpc template', () => {
      const trpcDirs = getTemplateDirectories('trpc');
      const spaDirs = getTemplateDirectories('spa');

      expect(trpcDirs).toEqual(spaDirs);
    });
  });
});

// ============================================================================
// Template Generation Tests
// ============================================================================

describe('generateTemplateFiles', () => {
  const baseConfig: TemplateConfig = {
    projectName: 'my-test-app',
    packageManager: 'pnpm',
    database: 'sqlite',
    template: 'spa',
  };

  describe('SPA template', () => {
    it('should generate files for spa template', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'spa' });

      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => f.path && f.content)).toBe(true);
    });

    it('should include package.json files', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'spa' });
      const packageFiles = files.filter((f) => f.path.includes('package.json'));

      expect(packageFiles.length).toBeGreaterThanOrEqual(1);
    });

    it('should include prisma schema', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'spa' });
      const schemaFile = files.find((f) => f.path.includes('schema.prisma'));

      expect(schemaFile).toBeDefined();
      expect(schemaFile?.content).toContain('generator client');
    });

    it('should include README', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'spa' });
      const readme = files.find((f) => f.path.includes('README.md'));

      expect(readme).toBeDefined();
    });
  });

  describe('Auth template', () => {
    it('should generate files for auth template', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'auth' });

      expect(files.length).toBeGreaterThan(0);
    });

    it('should include auth-specific files', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'auth' });
      const authFiles = files.filter(
        (f) =>
          f.path.includes('auth') || f.content.includes('JWT') || f.content.includes('password')
      );

      expect(authFiles.length).toBeGreaterThan(0);
    });

    it('should include JWT secrets in env file', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'auth' });
      // Auth template uses monorepo structure: apps/api/.env
      const envFile = files.find((f) => f.path.includes('.env') && !f.path.includes('.example'));

      expect(envFile).toBeDefined();
      expect(envFile?.content).toContain('JWT_SECRET');
      expect(envFile?.content).toContain('JWT_REFRESH_SECRET');
    });
  });

  describe('tRPC template', () => {
    it('should generate files for trpc template', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'trpc' });

      expect(files.length).toBeGreaterThan(0);
    });

    it('should include tRPC configuration', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'trpc' });
      const trpcFiles = files.filter(
        (f) => f.path.includes('trpc') || f.content.includes('@trpc') || f.content.includes('tRPC')
      );

      expect(trpcFiles.length).toBeGreaterThan(0);
    });
  });

  describe('RSC template', () => {
    it('should generate files for rsc template', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'rsc' });

      expect(files.length).toBeGreaterThan(0);
    });

    it('should include app.config.ts', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'rsc' });
      const appConfig = files.find((f) => f.path === 'app.config.ts');

      expect(appConfig).toBeDefined();
      expect(appConfig?.content).toContain('createVeloxApp');
    });

    it('should include entry points', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'rsc' });
      const serverEntry = files.find((f) => f.path === 'src/entry.server.tsx');
      const clientEntry = files.find((f) => f.path === 'src/entry.client.tsx');

      expect(serverEntry).toBeDefined();
      expect(clientEntry).toBeDefined();
    });

    it('should include pages and layouts', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'rsc' });
      const indexPage = files.find((f) => f.path === 'app/pages/index.tsx');
      const rootLayout = files.find((f) => f.path === 'app/layouts/root.tsx');

      expect(indexPage).toBeDefined();
      expect(rootLayout).toBeDefined();
    });
  });

  describe('RSC-Auth template', () => {
    it('should generate files for rsc-auth template', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'rsc-auth' });

      expect(files.length).toBeGreaterThan(0);
    });

    it('should include auth pages', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'rsc-auth' });
      const loginPage = files.find((f) => f.path === 'app/pages/auth/login.tsx');
      const registerPage = files.find((f) => f.path === 'app/pages/auth/register.tsx');

      expect(loginPage).toBeDefined();
      expect(registerPage).toBeDefined();
    });

    it('should include dashboard page', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'rsc-auth' });
      const dashboardPage = files.find((f) => f.path === 'app/pages/dashboard/index.tsx');

      expect(dashboardPage).toBeDefined();
    });

    it('should include auth actions', () => {
      const files = generateTemplateFiles({ ...baseConfig, template: 'rsc-auth' });
      const authAction = files.find((f) => f.path === 'app/actions/auth.ts');

      expect(authAction).toBeDefined();
      expect(authAction?.content).toContain('use server');
    });
  });

  describe('Database configuration', () => {
    it('should use sqlite adapter for sqlite database', () => {
      const files = generateTemplateFiles({ ...baseConfig, database: 'sqlite' });
      const dbFile = files.find((f) => f.path.includes('database'));

      // Template uses PrismaBetterSqlite3 adapter for SQLite
      expect(dbFile?.content).toContain('PrismaBetterSqlite3');
      expect(dbFile?.content).not.toContain('PrismaPg');
    });

    it('should use postgresql adapter for postgresql database', () => {
      const files = generateTemplateFiles({ ...baseConfig, database: 'postgresql' });
      const dbFile = files.find((f) => f.path.includes('database'));

      // Template uses PrismaPg adapter for PostgreSQL
      expect(dbFile?.content).toContain('PrismaPg');
      expect(dbFile?.content).not.toContain('PrismaBetterSqlite3');
    });
  });

  describe('Package manager configuration', () => {
    it('should use pnpm commands for pnpm', () => {
      const files = generateTemplateFiles({ ...baseConfig, packageManager: 'pnpm' });
      const readme = files.find((f) => f.path.includes('README'));

      expect(readme?.content).toContain('pnpm');
    });

    it('should use npm commands for npm', () => {
      const files = generateTemplateFiles({ ...baseConfig, packageManager: 'npm' });
      const readme = files.find((f) => f.path.includes('README'));

      expect(readme?.content).toContain('npm run');
    });
  });

  describe('Project name placeholder', () => {
    it('should replace project name in package.json', () => {
      const files = generateTemplateFiles({ ...baseConfig, projectName: 'custom-project' });
      const rootPackage = files.find((f) => f.path === 'package.json');

      expect(rootPackage?.content).toContain('custom-project');
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  it('should throw for invalid template type', () => {
    const invalidConfig = {
      projectName: 'test',
      packageManager: 'pnpm' as const,
      database: 'sqlite' as const,
      template: 'invalid' as TemplateType,
    };

    expect(() => generateTemplateFiles(invalidConfig)).toThrow('Unknown template');
  });
});
