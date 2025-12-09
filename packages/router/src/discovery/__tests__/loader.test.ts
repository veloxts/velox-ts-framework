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

// ============================================================================
// Symlink Handling Tests
// ============================================================================

describe('Symlink Handling', () => {
  // Skip symlink tests on Windows as symlinks require admin privileges
  const describeUnix = process.platform === 'win32' ? describe.skip : describe;

  describeUnix('file symlinks', () => {
    it('should follow symlinked files and discover procedures', async () => {
      const realFile = await createFile(tempDir, 'real-procedures.ts', validProcedureContent);
      const linkPath = path.join(tempDir, 'linked-procedures.ts');

      await fs.symlink(realFile, linkPath);

      const result = await discoverProceduresVerbose(tempDir);

      // Should discover both the real file and symlink
      expect(result.scannedFiles.length).toBeGreaterThanOrEqual(1);
      expect(result.collections.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle broken symlinks without crashing', async () => {
      await createFile(tempDir, 'valid.ts', validProcedureContent);
      const brokenLink = path.join(tempDir, 'broken-link.ts');

      // Create symlink to non-existent file
      await fs.symlink('/tmp/nonexistent-file-xyz-12345.ts', brokenLink);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should skip broken symlink and continue with valid file
      const collections = await discoverProcedures(tempDir, { onInvalidExport: 'warn' });

      expect(collections).toHaveLength(1);
      expect(collections[0].namespace).toBe('test');

      warnSpy.mockRestore();
    });
  });

  describeUnix('directory symlinks', () => {
    it('should follow symlinked directories in recursive mode', async () => {
      const realDir = await createSubDir(tempDir, 'real-dir');
      await createFile(realDir, 'procedures.ts', validProcedureContent);

      const linkDir = path.join(tempDir, 'linked-dir');
      await fs.symlink(realDir, linkDir, 'dir');

      const collections = await discoverProcedures(tempDir, { recursive: true });

      expect(collections.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect and handle circular symlinks without hanging', async () => {
      const subDir = await createSubDir(tempDir, 'subdirectory');
      await createFile(tempDir, 'valid.ts', validProcedureContent);

      // Create circular symlink: subdirectory/parent-link -> tempDir
      const circularLink = path.join(subDir, 'parent-link');
      await fs.symlink(tempDir, circularLink, 'dir');

      // Should complete without infinite loop
      const startTime = Date.now();
      const collections = await discoverProcedures(tempDir, { recursive: true });
      const duration = Date.now() - startTime;

      expect(collections).toHaveLength(1);
      expect(duration).toBeLessThan(5000); // Should not hang
    }, 10000);

    it('should handle multiple levels of symlinks without duplicates', async () => {
      const dirA = await createSubDir(tempDir, 'dirA');
      const dirB = await createSubDir(tempDir, 'dirB');
      await createFile(dirA, 'procedures.ts', validProcedureContent);

      // Create symlink from dirB to dirA
      const linkInB = path.join(dirB, 'link-to-a');
      await fs.symlink(dirA, linkInB, 'dir');

      const result = await discoverProceduresVerbose(tempDir, { recursive: true });

      // Should visit dirA only once (either directly or via symlink)
      expect(result.collections).toHaveLength(1);
    });
  });
});

// ============================================================================
// Concurrent Discovery Tests
// ============================================================================

describe('Concurrent Discovery', () => {
  it('should handle multiple simultaneous discovery calls safely', async () => {
    await createFile(tempDir, 'users.ts', validProcedureContent);
    await createFile(tempDir, 'posts.ts', anotherValidProcedureContent);

    // Simulate concurrent discovery calls
    const concurrentCalls = 10;
    const promises = Array.from({ length: concurrentCalls }, () => discoverProcedures(tempDir));

    const results = await Promise.all(promises);

    // All calls should succeed with identical results
    results.forEach((collections) => {
      expect(collections).toHaveLength(2);
      const namespaces = collections.map((c) => c.namespace).sort();
      expect(namespaces).toEqual(['other', 'test']);
    });
  });

  it('should handle file system changes during discovery gracefully', async () => {
    await createFile(tempDir, 'initial.ts', validProcedureContent);

    // Start discovery
    const discoveryPromise = discoverProcedures(tempDir);

    // Immediately add another file while discovery might be in progress
    await createFile(tempDir, 'added-during.ts', anotherValidProcedureContent);

    // Discovery should complete successfully
    const collections = await discoveryPromise;

    // May have 1 or 2 depending on timing (both are valid)
    expect(collections.length).toBeGreaterThanOrEqual(1);
    expect(collections.length).toBeLessThanOrEqual(2);
  });
});

// ============================================================================
// Performance and Scalability Tests
// ============================================================================

describe('Performance and Scalability', () => {
  it('should handle directories with many files efficiently', async () => {
    // Create 50 procedure files
    const filePromises = Array.from({ length: 50 }, (_, i) => {
      const content = `
        export const proc${i} = {
          namespace: 'ns${i}',
          procedures: {
            get: { type: 'query', handler: async () => ({}), middlewares: [], guards: [] },
          },
        };
      `;
      return createFile(tempDir, `proc${i}.ts`, content);
    });
    await Promise.all(filePromises);

    const start = Date.now();
    const collections = await discoverProcedures(tempDir);
    const duration = Date.now() - start;

    expect(collections).toHaveLength(50);
    expect(duration).toBeLessThan(10000); // Should complete in reasonable time
  });

  it('should handle deep directory trees efficiently', async () => {
    // Create 5 levels deep
    let currentDir = tempDir;
    for (let i = 0; i < 5; i++) {
      currentDir = await createSubDir(currentDir, `level${i}`);
      await createFile(currentDir, `proc${i}.ts`, validProcedureContent);
    }

    const start = Date.now();
    const collections = await discoverProcedures(tempDir, { recursive: true });
    const duration = Date.now() - start;

    expect(collections).toHaveLength(5);
    expect(duration).toBeLessThan(5000);
  });
});

// ============================================================================
// Dynamic Import Error Variants Tests
// ============================================================================

describe('Dynamic Import Error Variants', () => {
  it('should handle module with runtime errors during import', async () => {
    const runtimeErrorContent = `
      throw new Error('Runtime error during module initialization');
      export const procedures = { namespace: 'test', procedures: {} };
    `;
    await createFile(tempDir, 'runtime-error.ts', runtimeErrorContent);

    await expect(discoverProcedures(tempDir)).rejects.toThrow(DiscoveryError);

    try {
      await discoverProcedures(tempDir);
    } catch (error) {
      expect(error).toBeInstanceOf(DiscoveryError);
      expect((error as DiscoveryError).code).toBe(DiscoveryErrorCode.FILE_LOAD_ERROR);
    }
  });

  it('should report syntax errors as FILE_LOAD_ERROR', async () => {
    const syntaxError = `
      export const procs = {
        namespace: 'test'
        // Missing comma and closing brace
    `;
    await createFile(tempDir, 'syntax-error.ts', syntaxError);

    await expect(discoverProcedures(tempDir)).rejects.toThrow(DiscoveryError);

    try {
      await discoverProcedures(tempDir);
    } catch (error) {
      expect(error).toBeInstanceOf(DiscoveryError);
      expect((error as DiscoveryError).code).toBe(DiscoveryErrorCode.FILE_LOAD_ERROR);
    }
  });

  it('should continue with valid files when one has runtime errors (warn mode)', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(
      tempDir,
      'broken-runtime.ts',
      `
      throw new Error('Module initialization error');
      export const procs = { namespace: 'broken', procedures: {} };
    `
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const collections = await discoverProcedures(tempDir, { onInvalidExport: 'warn' });

    expect(collections).toHaveLength(1);
    expect(collections[0].namespace).toBe('test');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

// ============================================================================
// Pattern Matching Edge Cases Tests
// ============================================================================

describe('Pattern Matching Edge Cases', () => {
  it('should handle patterns with multiple wildcards', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(tempDir, 'test.integration.ts', anotherValidProcedureContent);

    const collections = await discoverProcedures(tempDir, {
      exclude: ['*.integration.*'],
    });

    expect(collections).toHaveLength(1);
    expect(collections[0].namespace).toBe('test');
  });

  it('should handle empty exclude pattern array', async () => {
    await createFile(tempDir, 'users.ts', validProcedureContent);
    await createFile(tempDir, 'users.test.ts', anotherValidProcedureContent);

    const collections = await discoverProcedures(tempDir, {
      exclude: [], // Empty exclusion list - should include test files
    });

    expect(collections).toHaveLength(2);
  });

  it('should match exact patterns case-sensitively', async () => {
    await createFile(tempDir, 'users.ts', validProcedureContent);
    await createFile(tempDir, 'admin.ts', anotherValidProcedureContent);

    // Pattern 'admin.*' should match 'admin.ts' exactly
    const collections = await discoverProcedures(tempDir, {
      exclude: ['admin.*'],
    });

    expect(collections).toHaveLength(1);
    expect(collections[0].namespace).toBe('test');
  });

  it('should handle patterns with escaped special characters', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    // The pattern escapes special regex characters properly
    const collections = await discoverProcedures(tempDir, {
      exclude: ['file.test.ts'], // Literal dots should be escaped
    });

    expect(collections).toHaveLength(1);
  });
});

// ============================================================================
// ESM File URL Edge Cases Tests
// ============================================================================

describe('ESM File URL Edge Cases', () => {
  it('should handle paths with spaces', async () => {
    const dirWithSpaces = await createSubDir(tempDir, 'folder with spaces');
    await createFile(dirWithSpaces, 'users.ts', validProcedureContent);

    const collections = await discoverProcedures(dirWithSpaces);

    expect(collections).toHaveLength(1);
  });

  it('should handle paths with special URL characters', async () => {
    // Test directory name with characters that need URL encoding
    const specialDir = await createSubDir(tempDir, 'folder%name');
    await createFile(specialDir, 'users.ts', validProcedureContent);

    const collections = await discoverProcedures(specialDir);

    expect(collections).toHaveLength(1);
  });

  it('should handle paths with parentheses', async () => {
    const parenDir = await createSubDir(tempDir, 'folder(1)');
    await createFile(parenDir, 'users.ts', validProcedureContent);

    const collections = await discoverProcedures(parenDir);

    expect(collections).toHaveLength(1);
  });
});

// ============================================================================
// Empty and Minimal File Edge Cases Tests
// ============================================================================

describe('Empty and Minimal File Edge Cases', () => {
  it('should handle truly empty files (0 bytes)', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(tempDir, 'empty.ts', '');

    const collections = await discoverProcedures(tempDir);

    expect(collections).toHaveLength(1);
  });

  it('should handle files with only comments', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(tempDir, 'comments-only.ts', '// This is just a comment\n/* Block comment */');

    const collections = await discoverProcedures(tempDir);

    expect(collections).toHaveLength(1);
  });

  it('should handle files with only whitespace', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(tempDir, 'whitespace.ts', '   \n\n\t\t  \n  ');

    const collections = await discoverProcedures(tempDir);

    expect(collections).toHaveLength(1);
  });

  it('should handle files with default export only', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(tempDir, 'default-only.ts', 'export default { foo: "bar" };');

    const collections = await discoverProcedures(tempDir);

    expect(collections).toHaveLength(1);
  });
});

// ============================================================================
// Special Directory Exclusion Tests
// ============================================================================

describe('Special Directory Exclusions', () => {
  it('should skip .git directory even in recursive mode', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    const gitDir = await createSubDir(tempDir, '.git');
    await createFile(gitDir, 'hooks.ts', anotherValidProcedureContent);

    const collections = await discoverProcedures(tempDir, { recursive: true });

    expect(collections).toHaveLength(1);
  });

  it('should skip __mocks__ directory in recursive mode', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    const mocksDir = await createSubDir(tempDir, '__mocks__');
    await createFile(mocksDir, 'mocks.ts', anotherValidProcedureContent);

    const collections = await discoverProcedures(tempDir, { recursive: true });

    expect(collections).toHaveLength(1);
  });

  it('should skip multiple excluded directories', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);

    const testsDir = await createSubDir(tempDir, '__tests__');
    await createFile(testsDir, 'test-procs.ts', anotherValidProcedureContent);

    const mocksDir = await createSubDir(tempDir, '__mocks__');
    await createFile(mocksDir, 'mock-procs.ts', anotherValidProcedureContent);

    const nodeModules = await createSubDir(tempDir, 'node_modules');
    await createFile(nodeModules, 'pkg-procs.ts', anotherValidProcedureContent);

    const collections = await discoverProcedures(tempDir, { recursive: true });

    expect(collections).toHaveLength(1);
    expect(collections[0].namespace).toBe('test');
  });
});

// ============================================================================
// Warning Message Format Tests
// ============================================================================

describe('Warning Message Format', () => {
  it('should include file path in warning message', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(tempDir, 'invalid.ts', invalidProcedureLikeContent);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await discoverProcedures(tempDir, { onInvalidExport: 'warn' });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[Discovery Warning]'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid.ts'));

    warnSpy.mockRestore();
  });

  it('should track warnings in verbose result', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(tempDir, 'invalid.ts', invalidProcedureLikeContent);

    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await discoverProceduresVerbose(tempDir, { onInvalidExport: 'warn' });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].filePath).toContain('invalid.ts');
    expect(result.warnings[0].message).toBeDefined();
    expect(result.warnings[0].code).toBe(DiscoveryErrorCode.INVALID_EXPORT);

    vi.restoreAllMocks();
  });
});

// ============================================================================
// Default Options Validation Tests
// ============================================================================

describe('Default Options Validation', () => {
  it('should use default extensions when not specified', async () => {
    await createFile(tempDir, 'file.ts', validProcedureContent);
    await createFile(tempDir, 'file2.js', anotherValidProcedureContent);

    const collections = await discoverProcedures(tempDir);

    // Both .ts and .js are in default extensions
    expect(collections).toHaveLength(2);
  });

  it('should use default exclude patterns when not specified', async () => {
    await createFile(tempDir, 'users.ts', validProcedureContent);
    await createFile(tempDir, 'users.test.ts', anotherValidProcedureContent);
    await createFile(tempDir, 'users.spec.ts', anotherValidProcedureContent);
    await createFile(tempDir, 'index.ts', 'export * from "./users.js"');

    const collections = await discoverProcedures(tempDir);

    // Only users.ts should be discovered (test, spec, index excluded by default)
    expect(collections).toHaveLength(1);
    expect(collections[0].namespace).toBe('test');
  });

  it('should default recursive to false', async () => {
    await createFile(tempDir, 'users.ts', validProcedureContent);
    const subDir = await createSubDir(tempDir, 'nested');
    await createFile(subDir, 'posts.ts', anotherValidProcedureContent);

    const collections = await discoverProcedures(tempDir); // No recursive option

    expect(collections).toHaveLength(1); // Only root level
  });

  it('should default onInvalidExport to throw', async () => {
    await createFile(tempDir, 'invalid.ts', invalidProcedureLikeContent);

    await expect(discoverProcedures(tempDir)).rejects.toThrow(DiscoveryError);
  });
});

// ============================================================================
// looksLikeProcedureCollection Heuristic Tests
// ============================================================================

describe('looksLikeProcedureCollection Heuristic', () => {
  it('should detect objects with namespace but null procedures (passes heuristic, fails validation)', async () => {
    // This has namespace:string and typeof procedures === 'object', so passes looksLike
    // But procedures is null, which fails isProcedureCollection
    const almostValid = `
      export const notQuite = {
        namespace: 'almost',
        procedures: null,
      };
    `;
    await createFile(tempDir, 'almost.ts', almostValid);

    await expect(discoverProcedures(tempDir)).rejects.toThrow(DiscoveryError);
  });

  it('should accept objects with namespace and non-null procedures object', async () => {
    // isProcedureCollection is lenient - just requires namespace:string and procedures:object (non-null)
    const validButMinimal = `
      export const minimal = {
        namespace: 'minimal',
        procedures: {},
      };
    `;
    await createFile(tempDir, 'minimal.ts', validButMinimal);

    const collections = await discoverProcedures(tempDir);

    expect(collections).toHaveLength(1);
    expect(collections[0].namespace).toBe('minimal');
  });

  it('should ignore objects missing namespace property', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(
      tempDir,
      'helpers.ts',
      `
      export const config = { procedures: {} }; // Missing 'namespace'
    `
    );

    const collections = await discoverProcedures(tempDir);

    expect(collections).toHaveLength(1);
  });

  it('should ignore objects missing procedures property', async () => {
    await createFile(tempDir, 'valid.ts', validProcedureContent);
    await createFile(
      tempDir,
      'helpers.ts',
      `
      export const logger = { namespace: 'log' }; // Missing 'procedures'
    `
    );

    const collections = await discoverProcedures(tempDir);

    expect(collections).toHaveLength(1);
  });
});
