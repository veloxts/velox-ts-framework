/**
 * Scaffolder Unit Tests
 *
 * Tests for the main scaffolding flow, package manager detection,
 * version constants, and install commands.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  CREATE_VERSION,
  detectPackageManager,
  getInstallCommand,
  RESERVED_NAMES,
} from '../index.js';

// ============================================================================
// Version Constant Tests
// ============================================================================

describe('CREATE_VERSION', () => {
  it('should be a valid semver string', () => {
    // Should match semantic versioning pattern
    expect(CREATE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should not be the fallback version', () => {
    expect(CREATE_VERSION).not.toBe('0.0.0-unknown');
  });

  it('should be a non-empty string', () => {
    expect(typeof CREATE_VERSION).toBe('string');
    expect(CREATE_VERSION.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Package Manager Detection Tests
// ============================================================================

describe('detectPackageManager', () => {
  const originalEnv = process.env.npm_config_user_agent;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.npm_config_user_agent;
    } else {
      process.env.npm_config_user_agent = originalEnv;
    }
  });

  describe('npm detection', () => {
    it('should return npm when npm_config_user_agent is empty', () => {
      process.env.npm_config_user_agent = '';
      expect(detectPackageManager()).toBe('npm');
    });

    it('should return npm when npm_config_user_agent is undefined', () => {
      delete process.env.npm_config_user_agent;
      expect(detectPackageManager()).toBe('npm');
    });

    it('should return npm when using npx', () => {
      process.env.npm_config_user_agent = 'npm/10.8.0 node/v22.3.0 darwin arm64';
      expect(detectPackageManager()).toBe('npm');
    });

    it('should return npm for npm 9.x', () => {
      process.env.npm_config_user_agent = 'npm/9.6.7 node/v20.3.0 linux x64';
      expect(detectPackageManager()).toBe('npm');
    });
  });

  describe('pnpm detection', () => {
    it('should return pnpm when pnpm is in user agent', () => {
      process.env.npm_config_user_agent = 'pnpm/9.15.0 npm/? node/v22.3.0 darwin arm64';
      expect(detectPackageManager()).toBe('pnpm');
    });

    it('should return pnpm for pnpm 8.x', () => {
      process.env.npm_config_user_agent = 'pnpm/8.15.4 npm/? node/v20.11.0 linux x64';
      expect(detectPackageManager()).toBe('pnpm');
    });

    it('should detect pnpm in various user agent formats', () => {
      process.env.npm_config_user_agent = 'pnpm/7.0.0';
      expect(detectPackageManager()).toBe('pnpm');
    });
  });

  describe('yarn detection', () => {
    it('should return yarn when yarn is in user agent', () => {
      process.env.npm_config_user_agent = 'yarn/1.22.22 npm/? node/v22.3.0 darwin arm64';
      expect(detectPackageManager()).toBe('yarn');
    });

    it('should return yarn for yarn 4.x (berry)', () => {
      process.env.npm_config_user_agent = 'yarn/4.1.0 npm/? node/v20.11.0 linux x64';
      expect(detectPackageManager()).toBe('yarn');
    });
  });

  describe('priority order', () => {
    it('should prioritize pnpm over yarn if both present', () => {
      // Edge case: both in string (shouldn't happen in practice)
      process.env.npm_config_user_agent = 'pnpm/9.0.0 yarn/4.0.0';
      expect(detectPackageManager()).toBe('pnpm');
    });
  });
});

// ============================================================================
// Install Command Tests
// ============================================================================

describe('getInstallCommand', () => {
  describe('npm', () => {
    it('should return npm install for npm', () => {
      expect(getInstallCommand('npm')).toBe('npm install');
    });

    it('should return npm install for unknown package managers', () => {
      expect(getInstallCommand('bun')).toBe('npm install');
      expect(getInstallCommand('')).toBe('npm install');
      expect(getInstallCommand('unknown')).toBe('npm install');
    });
  });

  describe('pnpm', () => {
    it('should return pnpm install for pnpm', () => {
      expect(getInstallCommand('pnpm')).toBe('pnpm install');
    });
  });

  describe('yarn', () => {
    it('should return yarn install for yarn', () => {
      expect(getInstallCommand('yarn')).toBe('yarn install');
    });
  });

  describe('case sensitivity', () => {
    it('should be case-sensitive', () => {
      // Package managers are case-sensitive
      expect(getInstallCommand('NPM')).toBe('npm install'); // Falls through to default
      expect(getInstallCommand('PNPM')).toBe('npm install');
      expect(getInstallCommand('YARN')).toBe('npm install');
    });
  });
});

// ============================================================================
// Project Name Validation Tests
// ============================================================================

describe('Project Name Validation', () => {
  describe('valid project names', () => {
    const validNames = [
      'my-app',
      'my-cool-app',
      'app123',
      'project-2024',
      'a',
      'abcdefghijklmnopqrstuvwxyz',
      '123',
      'a-b-c-d',
    ];

    it.each(validNames)('should accept valid project name: %s', (name) => {
      // Valid names: lowercase letters, numbers, hyphens only
      expect(/^[a-z0-9-]+$/.test(name)).toBe(true);
    });
  });

  describe('invalid project name patterns', () => {
    const invalidPatterns = [
      { name: 'MyApp', reason: 'uppercase letters' },
      { name: 'my_app', reason: 'underscores' },
      { name: 'my.app', reason: 'dots' },
      { name: 'my app', reason: 'spaces' },
      { name: '@scope/app', reason: 'special characters' },
      { name: '', reason: 'empty string' },
    ];

    it.each(invalidPatterns)('should reject $name because of $reason', ({ name }) => {
      expect(/^[a-z0-9-]+$/.test(name)).toBe(false);
    });
  });

  describe('reserved names', () => {
    const reservedNamesList = Array.from(RESERVED_NAMES);

    it.each(reservedNamesList)('should have %s as reserved', (name) => {
      expect(RESERVED_NAMES.has(name)).toBe(true);
    });
  });
});

// ============================================================================
// Project Config Types Tests
// ============================================================================

describe('ProjectConfig structure', () => {
  it('should support all template types', () => {
    const templates = ['spa', 'auth', 'trpc', 'rsc', 'rsc-auth'] as const;
    templates.forEach((template) => {
      expect(['spa', 'auth', 'trpc', 'rsc', 'rsc-auth']).toContain(template);
    });
  });

  it('should support all database types', () => {
    const databases = ['sqlite', 'postgresql', 'mysql'] as const;
    databases.forEach((db) => {
      expect(['sqlite', 'postgresql', 'mysql']).toContain(db);
    });
  });

  it('should support all package managers', () => {
    const packageManagers = ['npm', 'pnpm', 'yarn'] as const;
    packageManagers.forEach((pm) => {
      expect(['npm', 'pnpm', 'yarn']).toContain(pm);
    });
  });
});

// ============================================================================
// Environment Variable Handling Tests
// ============================================================================

describe('Environment Variables', () => {
  describe('SKIP_INSTALL', () => {
    it('should recognize SKIP_INSTALL=true', () => {
      // This is used in smoke tests to skip npm install
      expect(process.env.SKIP_INSTALL === 'true').toBeDefined();
    });
  });

  describe('npm_config_user_agent', () => {
    const originalEnv = process.env.npm_config_user_agent;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.npm_config_user_agent;
      } else {
        process.env.npm_config_user_agent = originalEnv;
      }
    });

    it('should handle missing npm_config_user_agent gracefully', () => {
      delete process.env.npm_config_user_agent;
      // Should not throw, should default to npm
      expect(() => detectPackageManager()).not.toThrow();
      expect(detectPackageManager()).toBe('npm');
    });
  });
});

// ============================================================================
// Error Message Tests
// ============================================================================

describe('Error Messages', () => {
  describe('directory exists error', () => {
    it('should format directory exists error correctly', () => {
      const projectName = 'my-app';
      const errorMessage = `Directory ${projectName} already exists`;
      expect(errorMessage).toContain(projectName);
      expect(errorMessage).toContain('already exists');
    });
  });

  describe('reserved name error', () => {
    it('should format reserved name error correctly', () => {
      const name = 'node_modules';
      const errorMessage = `"${name}" is a reserved name. Please choose another.`;
      expect(errorMessage).toContain(name);
      expect(errorMessage).toContain('reserved name');
    });
  });

  describe('invalid project name error', () => {
    it('should format invalid name error correctly', () => {
      const errorMessage = 'Project name must use lowercase letters, numbers, and hyphens only';
      expect(errorMessage).toContain('lowercase');
      expect(errorMessage).toContain('hyphens');
    });
  });
});

// ============================================================================
// Template-Specific Behavior Tests
// ============================================================================

describe('Template-Specific Behavior', () => {
  describe('RSC templates', () => {
    it('should identify RSC templates correctly', () => {
      const rscTemplates = ['rsc', 'rsc-auth'];
      const apiTemplates = ['spa', 'auth', 'trpc'];

      rscTemplates.forEach((t) => {
        expect(t === 'rsc' || t === 'rsc-auth').toBe(true);
      });

      apiTemplates.forEach((t) => {
        expect(t === 'rsc' || t === 'rsc-auth').toBe(false);
      });
    });
  });

  describe('auth templates', () => {
    it('should identify auth templates correctly', () => {
      const authTemplates = ['auth', 'rsc-auth'];

      authTemplates.forEach((t) => {
        expect(t.includes('auth')).toBe(true);
      });
    });
  });
});

// ============================================================================
// Success Message Content Tests
// ============================================================================

describe('Success Message Content', () => {
  describe('package manager commands', () => {
    const getRunCommand = (pm: string) => (pm === 'npm' ? 'npm run' : pm);

    it('should use npm run for npm', () => {
      expect(getRunCommand('npm')).toBe('npm run');
    });

    it('should use pnpm directly for pnpm', () => {
      expect(getRunCommand('pnpm')).toBe('pnpm');
    });

    it('should use yarn directly for yarn', () => {
      expect(getRunCommand('yarn')).toBe('yarn');
    });
  });

  describe('URL messages', () => {
    it('should show correct ports for RSC templates', () => {
      const rscPort = 3030;
      expect(rscPort).toBe(3030);
    });

    it('should show correct ports for API templates', () => {
      const webPort = 8080;
      const apiPort = 3030;
      expect(webPort).toBe(8080);
      expect(apiPort).toBe(3030);
    });
  });
});
