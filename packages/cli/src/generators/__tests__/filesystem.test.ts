/**
 * Filesystem Utilities Tests
 */

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  findAllSimilarFiles,
  findSimilarFiles,
  formatSimilarFilesWarning,
} from '../utils/filesystem.js';

describe('Similar File Detection', () => {
  const testDir = join(tmpdir(), `velox-test-${Date.now()}`);

  beforeAll(() => {
    // Create test directory structure
    mkdirSync(join(testDir, 'src', 'procedures'), { recursive: true });
    mkdirSync(join(testDir, 'src', 'schemas'), { recursive: true });
  });

  afterAll(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('findSimilarFiles', () => {
    it('should find no similar files in empty directory', () => {
      const result = findSimilarFiles(testDir, 'src/procedures/post.ts', 'post');
      expect(result.hasSimilar).toBe(false);
      expect(result.files).toHaveLength(0);
    });

    it('should detect plural form of entity', () => {
      // Create a plural variant file
      writeFileSync(join(testDir, 'src', 'procedures', 'users.ts'), '// existing');

      const result = findSimilarFiles(testDir, 'src/procedures/user.ts', 'user');

      expect(result.hasSimilar).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toMatchObject({
        path: 'src/procedures/users.ts',
        reason: 'plural',
      });
    });

    it('should detect singular form of entity', () => {
      // Create a singular variant file
      writeFileSync(join(testDir, 'src', 'schemas', 'user.ts'), '// existing');

      const result = findSimilarFiles(testDir, 'src/schemas/users.ts', 'user');

      expect(result.hasSimilar).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toMatchObject({
        path: 'src/schemas/user.ts',
        reason: 'singular',
      });
    });

    it('should detect different suffix variant', () => {
      // Create a .schema.ts variant
      writeFileSync(join(testDir, 'src', 'schemas', 'post.schema.ts'), '// existing');

      const result = findSimilarFiles(testDir, 'src/schemas/post.ts', 'post');

      expect(result.hasSimilar).toBe(true);
      expect(result.files.some((f) => f.path.includes('post.schema.ts'))).toBe(true);
    });

    it('should return empty result for non-existent directory', () => {
      const result = findSimilarFiles(testDir, 'src/nonexistent/user.ts', 'user');

      expect(result.hasSimilar).toBe(false);
      expect(result.files).toHaveLength(0);
    });

    it('should not include exact target path', () => {
      // Create the exact file
      writeFileSync(join(testDir, 'src', 'procedures', 'blog-post.ts'), '// existing');

      const result = findSimilarFiles(testDir, 'src/procedures/blog-post.ts', 'blog-post');

      // Should not include blog-post.ts as a "similar" file since it's the target
      expect(result.files.every((f) => f.path !== 'src/procedures/blog-post.ts')).toBe(true);
    });
  });

  describe('findAllSimilarFiles', () => {
    it('should check multiple target paths', () => {
      // Ensure users.ts exists
      writeFileSync(join(testDir, 'src', 'procedures', 'users.ts'), '// existing');

      const result = findAllSimilarFiles(
        testDir,
        ['src/procedures/user.ts', 'src/schemas/user.schema.ts'],
        'user'
      );

      expect(result.hasSimilar).toBe(true);
      // Should find the plural variant
      expect(result.files.some((f) => f.path.includes('users.ts'))).toBe(true);
    });

    it('should deduplicate files found in multiple checks', () => {
      const result = findAllSimilarFiles(
        testDir,
        ['src/procedures/user.ts', 'src/procedures/user-list.ts'],
        'user'
      );

      // Each unique file should only appear once
      const uniquePaths = new Set(result.files.map((f) => f.path));
      expect(uniquePaths.size).toBe(result.files.length);
    });
  });

  describe('formatSimilarFilesWarning', () => {
    it('should return empty string when no similar files', () => {
      const result = formatSimilarFilesWarning({ hasSimilar: false, files: [] }, 'User');
      expect(result).toBe('');
    });

    it('should format warning message with file list', () => {
      const result = formatSimilarFilesWarning(
        {
          hasSimilar: true,
          files: [
            { path: 'src/procedures/users.ts', reason: 'plural', targetPath: 'src/procedures/user.ts' },
          ],
        },
        'User'
      );

      expect(result).toContain('User');
      expect(result).toContain('src/procedures/users.ts');
      expect(result).toContain('plural form');
      expect(result).toContain('--force');
    });

    it('should show different reason text for each type', () => {
      const singularResult = formatSimilarFilesWarning(
        {
          hasSimilar: true,
          files: [{ path: 'src/user.ts', reason: 'singular', targetPath: 'src/users.ts' }],
        },
        'User'
      );
      expect(singularResult).toContain('singular form');

      const pluralResult = formatSimilarFilesWarning(
        {
          hasSimilar: true,
          files: [{ path: 'src/users.ts', reason: 'plural', targetPath: 'src/user.ts' }],
        },
        'User'
      );
      expect(pluralResult).toContain('plural form');

      const suffixResult = formatSimilarFilesWarning(
        {
          hasSimilar: true,
          files: [{ path: 'src/user.schema.ts', reason: 'different-suffix', targetPath: 'src/user.ts' }],
        },
        'User'
      );
      expect(suffixResult).toContain('different naming convention');
    });
  });
});
