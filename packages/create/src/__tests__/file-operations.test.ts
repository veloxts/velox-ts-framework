/**
 * File Operations and Security Unit Tests
 *
 * Tests for path safety, reserved names, and file system security.
 * These tests validate protection against path traversal attacks.
 */

import { describe, expect, it } from 'vitest';

import { isPathSafe, RESERVED_NAMES } from '../index.js';

// ============================================================================
// Path Safety Tests
// ============================================================================

describe('Path Safety (isPathSafe)', () => {
  const baseDir = '/Users/project/my-app';

  describe('valid paths', () => {
    it('should allow simple file names', () => {
      expect(isPathSafe(baseDir, 'package.json')).toBe(true);
      expect(isPathSafe(baseDir, 'README.md')).toBe(true);
      expect(isPathSafe(baseDir, '.gitignore')).toBe(true);
    });

    it('should allow nested paths', () => {
      expect(isPathSafe(baseDir, 'src/index.ts')).toBe(true);
      expect(isPathSafe(baseDir, 'src/api/routes.ts')).toBe(true);
      expect(isPathSafe(baseDir, 'apps/api/src/index.ts')).toBe(true);
    });

    it('should allow deeply nested paths', () => {
      expect(isPathSafe(baseDir, 'src/components/ui/buttons/primary.tsx')).toBe(true);
      expect(isPathSafe(baseDir, 'apps/web/src/pages/users/[id]/profile.tsx')).toBe(true);
    });

    it('should allow paths with dots in names', () => {
      expect(isPathSafe(baseDir, 'src/config.dev.ts')).toBe(true);
      expect(isPathSafe(baseDir, '.env.local')).toBe(true);
      expect(isPathSafe(baseDir, 'tsconfig.build.json')).toBe(true);
    });

    it('should allow paths with hyphens and underscores', () => {
      expect(isPathSafe(baseDir, 'src/my-component.ts')).toBe(true);
      expect(isPathSafe(baseDir, 'src/my_module.ts')).toBe(true);
      expect(isPathSafe(baseDir, 'src/my-component_v2.ts')).toBe(true);
    });

    it('should allow empty subpath (base directory itself)', () => {
      expect(isPathSafe(baseDir, '')).toBe(true);
      expect(isPathSafe(baseDir, '.')).toBe(true);
    });
  });

  describe('path traversal attacks', () => {
    it('should reject simple parent directory traversal', () => {
      expect(isPathSafe(baseDir, '../sensitive.txt')).toBe(false);
      expect(isPathSafe(baseDir, '../../etc/passwd')).toBe(false);
    });

    it('should reject double-dot embedded in path', () => {
      expect(isPathSafe(baseDir, 'src/../../../etc/passwd')).toBe(false);
      expect(isPathSafe(baseDir, 'deep/nested/../../../outside.txt')).toBe(false);
    });

    it('should reject traversal with valid-looking prefixes', () => {
      expect(isPathSafe(baseDir, 'src/components/../../..')).toBe(false);
      // Note: '..secrets' is a valid filename (not traversal), so this stays in base
      expect(isPathSafe(baseDir, 'src/api/../../..secrets')).toBe(true);
      // But this one actually escapes
      expect(isPathSafe(baseDir, 'src/api/../../../outside')).toBe(false);
    });

    it('should reject absolute paths outside base', () => {
      expect(isPathSafe(baseDir, '/etc/passwd')).toBe(false);
      expect(isPathSafe(baseDir, '/tmp/malicious')).toBe(false);
      expect(isPathSafe(baseDir, '/Users/other/project')).toBe(false);
    });

    it('should handle Windows-style paths (cross-platform)', () => {
      // Even on Unix, we should be careful about these patterns
      const winBase = 'C:\\Users\\project\\my-app';
      expect(isPathSafe(winBase, '..\\..\\Windows\\System32')).toBe(false);
    });

    it('should handle null bytes in paths', () => {
      // In Node.js, null bytes don't truncate paths in path.resolve
      // They're treated as part of the string, so this stays within base
      expect(isPathSafe(baseDir, 'file.txt\0../secret')).toBe(true);
      // Real file systems would reject null bytes, but isPathSafe only checks containment
    });

    it('should handle URL-encoded traversal attempts', () => {
      // After URL decoding, this would be ../
      // Note: isPathSafe doesn't decode URLs, but paths might come pre-decoded
      expect(isPathSafe(baseDir, '%2e%2e/passwd')).toBe(true); // Literal string, not decoded
      expect(isPathSafe(baseDir, decodeURIComponent('%2e%2e/passwd'))).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle trailing slashes', () => {
      expect(isPathSafe(baseDir, 'src/')).toBe(true);
      expect(isPathSafe(baseDir, 'src/api/')).toBe(true);
      expect(isPathSafe(`${baseDir}/`, 'src')).toBe(true);
    });

    it('should handle double slashes', () => {
      expect(isPathSafe(baseDir, 'src//index.ts')).toBe(true);
      expect(isPathSafe(baseDir, 'src////nested////file.ts')).toBe(true);
    });

    it('should handle mixed case on case-sensitive systems', () => {
      // These should be safe relative to base
      expect(isPathSafe(baseDir, 'SRC/Index.ts')).toBe(true);
      expect(isPathSafe(baseDir, 'Package.JSON')).toBe(true);
    });

    it('should handle paths with spaces', () => {
      expect(isPathSafe(baseDir, 'src/my file.ts')).toBe(true);
      expect(isPathSafe(baseDir, 'folder with spaces/file.ts')).toBe(true);
    });

    it('should handle paths with special characters', () => {
      expect(isPathSafe(baseDir, 'src/@types/index.d.ts')).toBe(true);
      expect(isPathSafe(baseDir, 'src/+page.svelte')).toBe(true);
      expect(isPathSafe(baseDir, 'src/[id].tsx')).toBe(true);
    });

    it('should correctly handle base path containing special chars', () => {
      const specialBase = '/Users/user/my project/@velox-app';
      expect(isPathSafe(specialBase, 'src/index.ts')).toBe(true);
      expect(isPathSafe(specialBase, '../escape')).toBe(false);
    });
  });

  describe('symlink-like paths', () => {
    it('should allow single dots (current directory)', () => {
      expect(isPathSafe(baseDir, './src/index.ts')).toBe(true);
      expect(isPathSafe(baseDir, 'src/./nested/./file.ts')).toBe(true);
    });

    it('should handle normalized parent references that stay in bounds', () => {
      // Going up and then back down within the same directory is ok
      expect(isPathSafe(baseDir, 'src/../src/index.ts')).toBe(true);
      expect(isPathSafe(baseDir, 'deep/nested/../nested/file.ts')).toBe(true);
    });

    it('should reject if final resolved path escapes base', () => {
      // Even if path looks complex, final resolution must be within base
      expect(isPathSafe(baseDir, 'a/b/c/d/../../../../..')).toBe(false);
    });
  });
});

// ============================================================================
// Reserved Names Tests
// ============================================================================

describe('Reserved Names (RESERVED_NAMES)', () => {
  describe('contains expected reserved names', () => {
    it('should include common directory names', () => {
      expect(RESERVED_NAMES.has('node_modules')).toBe(true);
      expect(RESERVED_NAMES.has('dist')).toBe(true);
      expect(RESERVED_NAMES.has('build')).toBe(true);
      expect(RESERVED_NAMES.has('src')).toBe(true);
      expect(RESERVED_NAMES.has('lib')).toBe(true);
      expect(RESERVED_NAMES.has('public')).toBe(true);
    });

    it('should include test directories', () => {
      expect(RESERVED_NAMES.has('test')).toBe(true);
      expect(RESERVED_NAMES.has('tests')).toBe(true);
    });

    it('should include package manager names', () => {
      expect(RESERVED_NAMES.has('npm')).toBe(true);
      expect(RESERVED_NAMES.has('pnpm')).toBe(true);
      expect(RESERVED_NAMES.has('yarn')).toBe(true);
    });

    it('should include "package" as reserved', () => {
      expect(RESERVED_NAMES.has('package')).toBe(true);
    });
  });

  describe('does not include valid project names', () => {
    it('should allow typical project names', () => {
      expect(RESERVED_NAMES.has('my-app')).toBe(false);
      expect(RESERVED_NAMES.has('acme-project')).toBe(false);
      expect(RESERVED_NAMES.has('velox-app')).toBe(false);
    });

    it('should allow numbered names', () => {
      expect(RESERVED_NAMES.has('project1')).toBe(false);
      expect(RESERVED_NAMES.has('app123')).toBe(false);
      expect(RESERVED_NAMES.has('2024-project')).toBe(false);
    });

    it('should allow framework-specific names that are not reserved', () => {
      expect(RESERVED_NAMES.has('api')).toBe(false);
      expect(RESERVED_NAMES.has('web')).toBe(false);
      expect(RESERVED_NAMES.has('server')).toBe(false);
      expect(RESERVED_NAMES.has('client')).toBe(false);
    });
  });

  describe('reserved names set properties', () => {
    it('should be a Set for O(1) lookups', () => {
      expect(RESERVED_NAMES).toBeInstanceOf(Set);
    });

    it('should have a reasonable number of reserved names', () => {
      // Not too few (missing protection) or too many (over-restrictive)
      expect(RESERVED_NAMES.size).toBeGreaterThanOrEqual(10);
      expect(RESERVED_NAMES.size).toBeLessThanOrEqual(50);
    });

    it('should contain only lowercase names', () => {
      for (const name of RESERVED_NAMES) {
        expect(name).toBe(name.toLowerCase());
      }
    });

    it('should not contain empty string', () => {
      expect(RESERVED_NAMES.has('')).toBe(false);
    });
  });
});

// ============================================================================
// Integration: Path + Reserved Names
// ============================================================================

describe('Path and Reserved Names Integration', () => {
  const baseDir = '/Users/project';

  it('should allow paths with reserved names as subdirectories', () => {
    // Reserved names can appear inside paths, just not as project root
    expect(isPathSafe(baseDir, 'src/node_modules/.gitkeep')).toBe(true);
    expect(isPathSafe(baseDir, 'vendor/dist/index.js')).toBe(true);
  });

  it('should validate both path safety and reserved names independently', () => {
    // Path safety check doesn't validate against reserved names
    // Reserved name check is separate concern
    expect(isPathSafe(baseDir, 'node_modules')).toBe(true); // Path is safe
    expect(RESERVED_NAMES.has('node_modules')).toBe(true); // But name is reserved
  });
});
