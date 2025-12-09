/**
 * Discovery Loader Tests
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DiscoveryError } from '../errors.js';
import { discoverProcedures, discoverProceduresVerbose } from '../loader.js';
import { DiscoveryErrorCode } from '../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

let tempDir: string;

async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'discovery-test-'));
}

async function createFile(dir: string, filename: string, content: string): Promise<string> {
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

async function createSubDir(dir: string, name: string): Promise<string> {
  const subDir = path.join(dir, name);
  await fs.mkdir(subDir, { recursive: true });
  return subDir;
}

// Valid procedure file content (exports a valid ProcedureCollection)
const validProcedureContent = `
export const testProcedures = {
  namespace: 'test',
  procedures: {
    getTest: {
      type: 'query',
      handler: async () => ({ id: '1' }),
      middlewares: [],
      guards: [],
    },
  },
};
`;

// Another valid procedure file
const anotherValidProcedureContent = `
export const otherProcedures = {
  namespace: 'other',
  procedures: {
    listOther: {
      type: 'query',
      handler: async () => [],
      middlewares: [],
      guards: [],
    },
  },
};
`;

// File with multiple exports (one valid, one not)
const mixedExportsContent = `
export const validProcedures = {
  namespace: 'valid',
  procedures: {
    getValid: {
      type: 'query',
      handler: async () => ({}),
      middlewares: [],
      guards: [],
    },
  },
};

export const notAProcedure = { foo: 'bar' };
export const CONSTANT = 42;
`;

// Invalid procedure-like content (has namespace but procedures is null)
// This passes looksLikeProcedureCollection but fails isProcedureCollection
const invalidProcedureLikeContent = `
export const almostProcedures = {
  namespace: 'almost',
  procedures: null,
};
`;

// File with syntax error
const syntaxErrorContent = `
export const broken = {
  namespace: 'broken'
  // missing comma and closing brace
`;

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(async () => {
  tempDir = await createTempDir();
});

afterEach(async () => {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// ============================================================================
// discoverProcedures Tests
// ============================================================================

describe('discoverProcedures', () => {
  describe('successful discovery', () => {
    it('should discover a single procedure file', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);

      const collections = await discoverProcedures(tempDir);

      expect(collections).toHaveLength(1);
      expect(collections[0].namespace).toBe('test');
    });

    it('should discover multiple procedure files', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);
      await createFile(tempDir, 'posts.ts', anotherValidProcedureContent);

      const collections = await discoverProcedures(tempDir);

      expect(collections).toHaveLength(2);
      const namespaces = collections.map((c) => c.namespace);
      expect(namespaces).toContain('test');
      expect(namespaces).toContain('other');
    });

    it('should handle files with multiple valid exports', async () => {
      // Create a file with two procedure collections
      const multiExportContent = `
        export const userProcedures = {
          namespace: 'users',
          procedures: {
            getUser: { type: 'query', handler: async () => ({}), middlewares: [], guards: [] },
          },
        };
        export const postProcedures = {
          namespace: 'posts',
          procedures: {
            getPost: { type: 'query', handler: async () => ({}), middlewares: [], guards: [] },
          },
        };
      `;
      await createFile(tempDir, 'combined.ts', multiExportContent);

      const collections = await discoverProcedures(tempDir);

      expect(collections).toHaveLength(2);
    });

    it('should ignore non-procedure exports', async () => {
      await createFile(tempDir, 'mixed.ts', mixedExportsContent);

      const collections = await discoverProcedures(tempDir);

      expect(collections).toHaveLength(1);
      expect(collections[0].namespace).toBe('valid');
    });

    it('should work with relative paths', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);

      // Use relative path with cwd option
      const relativePath = path.basename(tempDir);
      const parentDir = path.dirname(tempDir);

      const collections = await discoverProcedures(relativePath, { cwd: parentDir });

      expect(collections).toHaveLength(1);
    });

    it('should work with absolute paths', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);

      const collections = await discoverProcedures(tempDir);

      expect(collections).toHaveLength(1);
    });
  });

  describe('file filtering', () => {
    it('should only scan files with valid extensions', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);
      await createFile(tempDir, 'readme.md', '# README');
      await createFile(tempDir, 'config.json', '{}');

      const collections = await discoverProcedures(tempDir);

      expect(collections).toHaveLength(1);
    });

    it('should respect custom extensions option', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);
      await createFile(tempDir, 'posts.js', anotherValidProcedureContent);

      const collections = await discoverProcedures(tempDir, {
        extensions: ['.ts'], // Only .ts files
      });

      expect(collections).toHaveLength(1);
      expect(collections[0].namespace).toBe('test');
    });

    it('should exclude test files by default', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);
      await createFile(tempDir, 'users.test.ts', anotherValidProcedureContent);
      await createFile(tempDir, 'users.spec.ts', anotherValidProcedureContent);

      const collections = await discoverProcedures(tempDir);

      expect(collections).toHaveLength(1);
      expect(collections[0].namespace).toBe('test');
    });

    it('should exclude index files by default', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);
      await createFile(tempDir, 'index.ts', 'export * from "./users.js"');

      const collections = await discoverProcedures(tempDir);

      expect(collections).toHaveLength(1);
    });

    it('should exclude .d.ts files by default', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);
      await createFile(tempDir, 'types.d.ts', 'export type User = { id: string }');

      const collections = await discoverProcedures(tempDir);

      expect(collections).toHaveLength(1);
    });

    it('should respect custom exclude patterns', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);
      await createFile(tempDir, 'internal.ts', anotherValidProcedureContent);

      const collections = await discoverProcedures(tempDir, {
        exclude: ['internal.*'],
      });

      expect(collections).toHaveLength(1);
      expect(collections[0].namespace).toBe('test');
    });
  });

  describe('recursive scanning', () => {
    it('should not scan subdirectories by default', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);
      const subDir = await createSubDir(tempDir, 'nested');
      await createFile(subDir, 'posts.ts', anotherValidProcedureContent);

      const collections = await discoverProcedures(tempDir);

      expect(collections).toHaveLength(1);
      expect(collections[0].namespace).toBe('test');
    });

    it('should scan subdirectories when recursive is true', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);
      const subDir = await createSubDir(tempDir, 'nested');
      await createFile(subDir, 'posts.ts', anotherValidProcedureContent);

      const collections = await discoverProcedures(tempDir, { recursive: true });

      expect(collections).toHaveLength(2);
    });

    it('should skip __tests__ directories in recursive mode', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);
      const testsDir = await createSubDir(tempDir, '__tests__');
      await createFile(testsDir, 'fixtures.ts', anotherValidProcedureContent);

      const collections = await discoverProcedures(tempDir, { recursive: true });

      expect(collections).toHaveLength(1);
    });

    it('should skip node_modules in recursive mode', async () => {
      await createFile(tempDir, 'users.ts', validProcedureContent);
      const nodeModules = await createSubDir(tempDir, 'node_modules');
      await createFile(nodeModules, 'package.ts', anotherValidProcedureContent);

      const collections = await discoverProcedures(tempDir, { recursive: true });

      expect(collections).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should throw DIRECTORY_NOT_FOUND for missing directory', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist');

      await expect(discoverProcedures(nonExistentPath)).rejects.toThrow(DiscoveryError);

      try {
        await discoverProcedures(nonExistentPath);
      } catch (error) {
        expect(error).toBeInstanceOf(DiscoveryError);
        expect((error as DiscoveryError).code).toBe(DiscoveryErrorCode.DIRECTORY_NOT_FOUND);
      }
    });

    it('should throw NO_PROCEDURES_FOUND for empty directory', async () => {
      await expect(discoverProcedures(tempDir)).rejects.toThrow(DiscoveryError);

      try {
        await discoverProcedures(tempDir);
      } catch (error) {
        expect(error).toBeInstanceOf(DiscoveryError);
        expect((error as DiscoveryError).code).toBe(DiscoveryErrorCode.NO_PROCEDURES_FOUND);
      }
    });

    it('should throw NO_PROCEDURES_FOUND when only non-matching files exist', async () => {
      await createFile(tempDir, 'readme.md', '# README');
      await createFile(tempDir, 'index.ts', 'export {}');

      await expect(discoverProcedures(tempDir)).rejects.toThrow(DiscoveryError);
    });

    it('should throw FILE_LOAD_ERROR for files with syntax errors (onInvalidExport: throw)', async () => {
      await createFile(tempDir, 'broken.ts', syntaxErrorContent);

      await expect(discoverProcedures(tempDir)).rejects.toThrow(DiscoveryError);

      try {
        await discoverProcedures(tempDir);
      } catch (error) {
        expect(error).toBeInstanceOf(DiscoveryError);
        expect((error as DiscoveryError).code).toBe(DiscoveryErrorCode.FILE_LOAD_ERROR);
      }
    });
  });

  describe('onInvalidExport modes', () => {
    it('should throw by default on invalid exports', async () => {
      await createFile(tempDir, 'invalid.ts', invalidProcedureLikeContent);

      await expect(discoverProcedures(tempDir)).rejects.toThrow(DiscoveryError);
    });

    it('should continue on invalid exports when mode is warn', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await createFile(tempDir, 'valid.ts', validProcedureContent);
      await createFile(tempDir, 'invalid.ts', invalidProcedureLikeContent);

      const collections = await discoverProcedures(tempDir, { onInvalidExport: 'warn' });

      expect(collections).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should continue silently on invalid exports when mode is silent', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await createFile(tempDir, 'valid.ts', validProcedureContent);
      await createFile(tempDir, 'invalid.ts', invalidProcedureLikeContent);

      const collections = await discoverProcedures(tempDir, { onInvalidExport: 'silent' });

      expect(collections).toHaveLength(1);
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });
});

// ============================================================================
// discoverProceduresVerbose Tests
// ============================================================================

describe('discoverProceduresVerbose', () => {
  it('should return collections', async () => {
    await createFile(tempDir, 'users.ts', validProcedureContent);

    const result = await discoverProceduresVerbose(tempDir);

    expect(result.collections).toHaveLength(1);
    expect(result.collections[0].namespace).toBe('test');
  });

  it('should return scanned files', async () => {
    await createFile(tempDir, 'users.ts', validProcedureContent);
    await createFile(tempDir, 'posts.ts', anotherValidProcedureContent);

    const result = await discoverProceduresVerbose(tempDir);

    expect(result.scannedFiles).toHaveLength(2);
  });

  it('should return loaded files (only files with valid exports)', async () => {
    await createFile(tempDir, 'users.ts', validProcedureContent);
    await createFile(tempDir, 'empty.ts', 'export const CONSTANT = 42;');

    const result = await discoverProceduresVerbose(tempDir);

    expect(result.loadedFiles).toHaveLength(1);
    expect(result.loadedFiles[0]).toContain('users.ts');
  });

  it('should return warnings for invalid files in warn mode', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(tempDir, 'invalid.ts', invalidProcedureLikeContent);

    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await discoverProceduresVerbose(tempDir, { onInvalidExport: 'warn' });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].filePath).toContain('invalid.ts');
    expect(result.warnings[0].code).toBe(DiscoveryErrorCode.INVALID_EXPORT);

    vi.restoreAllMocks();
  });

  it('should return warnings for invalid files in silent mode', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(tempDir, 'invalid.ts', invalidProcedureLikeContent);

    const result = await discoverProceduresVerbose(tempDir, { onInvalidExport: 'silent' });

    expect(result.warnings).toHaveLength(1);
  });

  it('should return empty warnings when all files are valid', async () => {
    await createFile(tempDir, 'users.ts', validProcedureContent);

    const result = await discoverProceduresVerbose(tempDir);

    expect(result.warnings).toHaveLength(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle files with no exports', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(tempDir, 'empty.ts', '// Empty file');

    const collections = await discoverProcedures(tempDir);

    expect(collections).toHaveLength(1);
  });

  it('should handle files that only export constants', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(tempDir, 'constants.ts', 'export const API_VERSION = "1.0";');

    const collections = await discoverProcedures(tempDir);

    expect(collections).toHaveLength(1);
  });

  it('should return collections in sorted order (by file path)', async () => {
    await createFile(tempDir, 'z-last.ts', anotherValidProcedureContent);
    await createFile(tempDir, 'a-first.ts', validProcedureContent);

    const result = await discoverProceduresVerbose(tempDir);

    expect(result.scannedFiles[0]).toContain('a-first.ts');
    expect(result.scannedFiles[1]).toContain('z-last.ts');
  });

  it('should handle deeply nested directories in recursive mode', async () => {
    const level1 = await createSubDir(tempDir, 'level1');
    const level2 = await createSubDir(level1, 'level2');
    const level3 = await createSubDir(level2, 'level3');

    await createFile(level3, 'deep.ts', validProcedureContent);

    const collections = await discoverProcedures(tempDir, { recursive: true });

    expect(collections).toHaveLength(1);
  });
});
