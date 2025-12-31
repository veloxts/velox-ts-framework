/**
 * Filesystem Utilities Tests
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  findAllSimilarFiles,
  findSimilarFiles,
  formatSimilarFilesWarning,
} from '../utils/filesystem.js';

describe('Similar File Detection', () => {
  let testDir: string;

  beforeEach(() => {
    // Create fresh test directory for each test
    testDir = join(tmpdir(), `velox-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testDir, 'src', 'procedures'), { recursive: true });
    mkdirSync(join(testDir, 'src', 'schemas'), { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory after each test
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
      writeFileSync(join(testDir, 'src', 'procedures', 'users.ts'), '// existing');

      const result = findSimilarFiles(testDir, 'src/procedures/user.ts', 'user');

      expect(result.hasSimilar).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toMatchObject({
        path: normalize('src/procedures/users.ts'),
        reason: 'plural',
      });
    });

    it('should detect singular form of entity', () => {
      writeFileSync(join(testDir, 'src', 'schemas', 'user.ts'), '// existing');

      const result = findSimilarFiles(testDir, 'src/schemas/users.ts', 'user');

      expect(result.hasSimilar).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toMatchObject({
        path: normalize('src/schemas/user.ts'),
        reason: 'singular',
      });
    });

    it('should detect different suffix variant', () => {
      writeFileSync(join(testDir, 'src', 'schemas', 'post.schema.ts'), '// existing');

      const result = findSimilarFiles(testDir, 'src/schemas/post.ts', 'post');

      expect(result.hasSimilar).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toMatchObject({
        path: normalize('src/schemas/post.schema.ts'),
        reason: 'different-suffix',
      });
    });

    it('should return empty result for non-existent directory', () => {
      const result = findSimilarFiles(testDir, 'src/nonexistent/user.ts', 'user');

      expect(result.hasSimilar).toBe(false);
      expect(result.files).toHaveLength(0);
    });

    it('should not include exact target path', () => {
      // Create the exact file we're targeting
      writeFileSync(join(testDir, 'src', 'procedures', 'user.ts'), '// existing');

      const result = findSimilarFiles(testDir, 'src/procedures/user.ts', 'user');

      // Should not include user.ts as a "similar" file since it's the target itself
      expect(result.files.every((f) => f.path !== normalize('src/procedures/user.ts'))).toBe(true);
    });

    describe('compound entity names (kebab-case)', () => {
      it('should detect plural form of compound entity', () => {
        writeFileSync(join(testDir, 'src', 'procedures', 'blog-posts.ts'), '// existing');

        const result = findSimilarFiles(testDir, 'src/procedures/blog-post.ts', 'blog-post');

        expect(result.hasSimilar).toBe(true);
        expect(result.files).toHaveLength(1);
        expect(result.files[0]).toMatchObject({
          path: normalize('src/procedures/blog-posts.ts'),
          reason: 'plural',
        });
      });

      it('should detect singular form of compound entity', () => {
        writeFileSync(join(testDir, 'src', 'schemas', 'user-profile.ts'), '// existing');

        const result = findSimilarFiles(testDir, 'src/schemas/user-profiles.ts', 'user-profile');

        expect(result.hasSimilar).toBe(true);
        expect(result.files).toHaveLength(1);
        expect(result.files[0]).toMatchObject({
          path: normalize('src/schemas/user-profile.ts'),
          reason: 'singular',
        });
      });

      it('should detect different suffix for compound entity', () => {
        writeFileSync(join(testDir, 'src', 'schemas', 'order-item.schema.ts'), '// existing');

        const result = findSimilarFiles(testDir, 'src/schemas/order-item.ts', 'order-item');

        expect(result.hasSimilar).toBe(true);
        expect(result.files).toHaveLength(1);
        expect(result.files[0]).toMatchObject({
          path: normalize('src/schemas/order-item.schema.ts'),
          reason: 'different-suffix',
        });
      });

      it('should not match unrelated compound names', () => {
        // Create file with similar but different prefix
        writeFileSync(join(testDir, 'src', 'procedures', 'user-settings.ts'), '// existing');

        const result = findSimilarFiles(testDir, 'src/procedures/user-profile.ts', 'user-profile');

        // user-settings.ts should not be detected as similar to user-profile
        expect(result.hasSimilar).toBe(false);
        expect(result.files).toHaveLength(0);
      });
    });
  });

  describe('findAllSimilarFiles', () => {
    it('should check multiple target paths', () => {
      writeFileSync(join(testDir, 'src', 'procedures', 'users.ts'), '// existing');

      const result = findAllSimilarFiles(
        testDir,
        ['src/procedures/user.ts', 'src/schemas/user.schema.ts'],
        'user'
      );

      expect(result.hasSimilar).toBe(true);
      expect(result.files.some((f) => f.path.includes('users.ts'))).toBe(true);
    });

    it('should deduplicate files found in multiple checks', () => {
      // Create files that could be found by multiple target paths
      writeFileSync(join(testDir, 'src', 'procedures', 'users.ts'), '// existing');

      const result = findAllSimilarFiles(
        testDir,
        ['src/procedures/user.ts', 'src/procedures/user-list.ts'],
        'user'
      );

      // Each unique file should only appear once
      const uniquePaths = new Set(result.files.map((f) => f.path));
      expect(uniquePaths.size).toBe(result.files.length);
    });

    it('should find similar files across directories', () => {
      writeFileSync(join(testDir, 'src', 'procedures', 'users.ts'), '// procedures');
      writeFileSync(join(testDir, 'src', 'schemas', 'users.schema.ts'), '// schemas');

      const result = findAllSimilarFiles(
        testDir,
        ['src/procedures/user.ts', 'src/schemas/user.ts'],
        'user'
      );

      expect(result.hasSimilar).toBe(true);
      expect(result.files).toHaveLength(2);
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

    it('should format multiple files correctly', () => {
      const result = formatSimilarFilesWarning(
        {
          hasSimilar: true,
          files: [
            { path: 'src/procedures/users.ts', reason: 'plural', targetPath: 'src/procedures/user.ts' },
            { path: 'src/schemas/user.schema.ts', reason: 'different-suffix', targetPath: 'src/schemas/user.ts' },
          ],
        },
        'User'
      );

      expect(result).toContain('src/procedures/users.ts');
      expect(result).toContain('src/schemas/user.schema.ts');
      expect(result).toContain('plural form');
      expect(result).toContain('different naming convention');
    });
  });
});
