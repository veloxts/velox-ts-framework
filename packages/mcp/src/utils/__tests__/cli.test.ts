/**
 * @veloxts/mcp - CLI Resolution Tests
 * Tests for smart CLI binary resolution with fallbacks
 */

import { existsSync, readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveVeloxCLI } from '../cli.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('CLI Resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: files don't exist
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('resolveVeloxCLI', () => {
    describe('on Unix systems', () => {
      const originalPlatform = process.platform;

      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'darwin' });
      });

      afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should use local .bin/velox when it exists', () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          return path === '/project/node_modules/.bin/velox';
        });

        const result = resolveVeloxCLI('/project', ['make', 'procedure', 'User']);

        expect(result.command).toBe('/project/node_modules/.bin/velox');
        expect(result.args).toEqual(['make', 'procedure', 'User']);
        expect(result.isNpx).toBe(false);
      });

      it('should fallback to @veloxts/cli package when local bin not found', () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          return (
            path === '/project/node_modules/@veloxts/cli/package.json' ||
            path === '/project/node_modules/@veloxts/cli/dist/cli.js'
          );
        });
        vi.mocked(readFileSync).mockReturnValue(
          JSON.stringify({
            name: '@veloxts/cli',
            bin: { velox: './dist/cli.js' },
          })
        );

        const result = resolveVeloxCLI('/project', ['make', 'schema', 'Post']);

        expect(result.command).toBe('node');
        expect(result.args).toEqual([
          '/project/node_modules/@veloxts/cli/dist/cli.js',
          'make',
          'schema',
          'Post',
        ]);
        expect(result.isNpx).toBe(false);
      });

      it('should fallback to npx when no local installation found', () => {
        vi.mocked(existsSync).mockReturnValue(false);

        const result = resolveVeloxCLI('/project', ['migrate', 'status']);

        expect(result.command).toBe('npx');
        expect(result.args).toEqual(['@veloxts/cli', 'migrate', 'status']);
        expect(result.isNpx).toBe(true);
      });

      it('should handle package.json with string bin field', () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          return (
            path === '/project/node_modules/@veloxts/cli/package.json' ||
            path === '/project/node_modules/@veloxts/cli/dist/index.js'
          );
        });
        vi.mocked(readFileSync).mockReturnValue(
          JSON.stringify({
            name: '@veloxts/cli',
            bin: './dist/index.js',
          })
        );

        const result = resolveVeloxCLI('/project', ['dev']);

        expect(result.command).toBe('node');
        expect(result.args).toContain('/project/node_modules/@veloxts/cli/dist/index.js');
      });

      it('should fallback to npx when package.json read fails', () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          return path === '/project/node_modules/@veloxts/cli/package.json';
        });
        vi.mocked(readFileSync).mockImplementation(() => {
          throw new Error('EACCES: permission denied');
        });

        const result = resolveVeloxCLI('/project', ['make', 'model', 'User']);

        expect(result.command).toBe('npx');
        expect(result.isNpx).toBe(true);
      });
    });

    describe('on Windows systems', () => {
      const originalPlatform = process.platform;

      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'win32' });
      });

      afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should use .cmd wrapper on Windows when it exists', () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          return path === '/project/node_modules/.bin/velox.cmd';
        });

        const result = resolveVeloxCLI('/project', ['make', 'procedure', 'User']);

        expect(result.command).toBe('/project/node_modules/.bin/velox.cmd');
        expect(result.args).toEqual(['make', 'procedure', 'User']);
        expect(result.isNpx).toBe(false);
      });

      it('should not check Unix binary on Windows', () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          // Return true for Unix path (should be ignored on Windows)
          if (path === '/project/node_modules/.bin/velox') return true;
          return false;
        });

        const result = resolveVeloxCLI('/project', ['dev']);

        // Should fall through to npx since .cmd doesn't exist
        expect(result.command).toBe('npx');
        expect(result.isNpx).toBe(true);
      });

      it('should fallback to @veloxts/cli package on Windows', () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          return (
            path === '/project/node_modules/@veloxts/cli/package.json' ||
            path === '/project/node_modules/@veloxts/cli/dist/cli.js'
          );
        });
        vi.mocked(readFileSync).mockReturnValue(
          JSON.stringify({
            name: '@veloxts/cli',
            bin: { velox: './dist/cli.js' },
          })
        );

        const result = resolveVeloxCLI('/project', ['make', 'test', 'User']);

        expect(result.command).toBe('node');
        expect(result.isNpx).toBe(false);
      });
    });

    describe('edge cases', () => {
      const originalPlatform = process.platform;

      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
      });

      afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should handle empty args array', () => {
        vi.mocked(existsSync).mockReturnValue(false);

        const result = resolveVeloxCLI('/project', []);

        expect(result.command).toBe('npx');
        expect(result.args).toEqual(['@veloxts/cli']);
        expect(result.isNpx).toBe(true);
      });

      it('should handle package.json without bin field', () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          return path === '/project/node_modules/@veloxts/cli/package.json';
        });
        vi.mocked(readFileSync).mockReturnValue(
          JSON.stringify({
            name: '@veloxts/cli',
            main: './dist/index.js',
            // No bin field
          })
        );

        const result = resolveVeloxCLI('/project', ['dev']);

        expect(result.command).toBe('npx');
        expect(result.isNpx).toBe(true);
      });

      it('should handle package.json with bin object but no velox key', () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          return path === '/project/node_modules/@veloxts/cli/package.json';
        });
        vi.mocked(readFileSync).mockReturnValue(
          JSON.stringify({
            name: '@veloxts/cli',
            bin: { 'other-command': './dist/other.js' },
          })
        );

        const result = resolveVeloxCLI('/project', ['dev']);

        expect(result.command).toBe('npx');
        expect(result.isNpx).toBe(true);
      });

      it('should handle invalid JSON in package.json', () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          return path === '/project/node_modules/@veloxts/cli/package.json';
        });
        vi.mocked(readFileSync).mockReturnValue('{ invalid json }');

        const result = resolveVeloxCLI('/project', ['dev']);

        expect(result.command).toBe('npx');
        expect(result.isNpx).toBe(true);
      });

      it('should handle bin path that does not exist', () => {
        vi.mocked(existsSync).mockImplementation((path) => {
          // package.json exists but the bin path doesn't
          return path === '/project/node_modules/@veloxts/cli/package.json';
        });
        vi.mocked(readFileSync).mockReturnValue(
          JSON.stringify({
            name: '@veloxts/cli',
            bin: { velox: './dist/cli.js' },
          })
        );

        const result = resolveVeloxCLI('/project', ['dev']);

        expect(result.command).toBe('npx');
        expect(result.isNpx).toBe(true);
      });
    });
  });
});
