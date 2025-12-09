/**
 * Seeder Loader Tests
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  DEFAULT_SEEDERS_PATH,
  getSeederFiles,
  loadDatabaseSeeder,
  loadSeeders,
  seedersDirectoryExists,
} from '../loader.js';

// ============================================================================
// Test Helpers
// ============================================================================

let tempDir: string;

async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'seeder-test-'));
}

async function createSeederFile(dir: string, filename: string, content: string): Promise<string> {
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

async function createSeedersDirectory(
  basePath: string,
  seedersPath: string = DEFAULT_SEEDERS_PATH
): Promise<string> {
  const fullPath = path.join(basePath, seedersPath);
  await fs.mkdir(fullPath, { recursive: true });
  return fullPath;
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(async () => {
  tempDir = await createTempDir();
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('seedersDirectoryExists', () => {
  test('returns true when directory exists', async () => {
    await createSeedersDirectory(tempDir);
    const exists = await seedersDirectoryExists(tempDir);
    expect(exists).toBe(true);
  });

  test('returns false when directory does not exist', async () => {
    const exists = await seedersDirectoryExists(tempDir);
    expect(exists).toBe(false);
  });

  test('returns false when path is a file, not directory', async () => {
    const filePath = path.join(tempDir, DEFAULT_SEEDERS_PATH);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, 'not a directory', 'utf-8');
    const exists = await seedersDirectoryExists(tempDir);
    expect(exists).toBe(false);
  });

  test('works with custom seedersPath', async () => {
    const customPath = 'custom/seeders';
    await createSeedersDirectory(tempDir, customPath);
    const exists = await seedersDirectoryExists(tempDir, customPath);
    expect(exists).toBe(true);
  });
});

describe('loadSeeders', () => {
  test('finds all *Seeder.ts files', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );
    await createSeederFile(
      seedersDir,
      'PostSeeder.ts',
      `export const PostSeeder = { name: 'PostSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.seeders[0].seeder.name).toMatch(/UserSeeder|PostSeeder/);
    expect(result.seeders[1].seeder.name).toMatch(/UserSeeder|PostSeeder/);
  });

  test('finds all *.seeder.ts files', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'user.seeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );
    await createSeederFile(
      seedersDir,
      'post.seeder.ts',
      `export const PostSeeder = { name: 'PostSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  test('skips index.ts file', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(seedersDir, 'index.ts', `export * from './UserSeeder';`);
    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(1);
    expect(result.seeders[0].seeder.name).toBe('UserSeeder');
  });

  test('skips DatabaseSeeder.ts file', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'DatabaseSeeder.ts',
      `export const DatabaseSeeder = { name: 'DatabaseSeeder', run: async () => {} };`
    );
    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(1);
    expect(result.seeders[0].seeder.name).toBe('UserSeeder');
  });

  test('returns empty arrays when directory does not exist', async () => {
    const result = await loadSeeders(tempDir);

    expect(result.seeders).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  test('collects errors for failed imports', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    // Seeder without `run` function is not recognized as seeder-like
    await createSeederFile(
      seedersDir,
      'InvalidSeeder.ts',
      `export const InvalidSeeder = { name: 'InvalidSeeder' };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].filePath).toContain('InvalidSeeder.ts');
    expect(result.errors[0].error).toContain('No valid seeder export found');
  });

  test('continues loading after single file failure', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'InvalidSeeder.ts',
      `export const InvalidSeeder = { name: 'InvalidSeeder' };`
    );
    await createSeederFile(
      seedersDir,
      'ValidSeeder.ts',
      `export const ValidSeeder = { name: 'ValidSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.seeders[0].seeder.name).toBe('ValidSeeder');
  });

  test('returns loaded seeders with file paths', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(1);
    expect(result.seeders[0].filePath).toContain('UserSeeder.ts');
    expect(result.seeders[0].seeder.name).toBe('UserSeeder');
  });
});

describe('loadDatabaseSeeder', () => {
  test('finds DatabaseSeeder.ts', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'DatabaseSeeder.ts',
      `export default { name: 'DatabaseSeeder', run: async () => {} };`
    );

    const seeder = await loadDatabaseSeeder(tempDir);

    expect(seeder).not.toBeNull();
    expect(seeder?.name).toBe('DatabaseSeeder');
  });

  test('falls back to DatabaseSeeder.js', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'DatabaseSeeder.js',
      `export default { name: 'DatabaseSeeder', run: async () => {} };`
    );

    const seeder = await loadDatabaseSeeder(tempDir);

    expect(seeder).not.toBeNull();
    expect(seeder?.name).toBe('DatabaseSeeder');
  });

  test('returns null when DatabaseSeeder does not exist', async () => {
    await createSeedersDirectory(tempDir);

    const seeder = await loadDatabaseSeeder(tempDir);

    expect(seeder).toBeNull();
  });
});

describe('file pattern matching', () => {
  test('matches UserSeeder.ts', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);
    expect(result.seeders).toHaveLength(1);
  });

  test('matches user.seeder.ts', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'user.seeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);
    expect(result.seeders).toHaveLength(1);
  });

  test('matches UserSeeder.js', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.js',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);
    expect(result.seeders).toHaveLength(1);
  });

  test('matches user.seeder.js', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'user.seeder.js',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);
    expect(result.seeders).toHaveLength(1);
  });

  test('does not match random.ts', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(seedersDir, 'random.ts', `export const helper = () => {};`);

    const result = await loadSeeders(tempDir);
    expect(result.seeders).toHaveLength(0);
  });

  test('does not match seeder.txt', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(seedersDir, 'seeder.txt', `Some text file`);

    const result = await loadSeeders(tempDir);
    expect(result.seeders).toHaveLength(0);
  });
});

describe('export detection', () => {
  test('detects default export', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export default { name: 'UserSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(1);
    expect(result.seeders[0].seeder.name).toBe('UserSeeder');
  });

  test('detects named *Seeder export', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(1);
    expect(result.seeders[0].seeder.name).toBe('UserSeeder');
  });

  test('returns error when no valid export found', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const invalidExport = { name: 'UserSeeder' };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('No valid seeder export found');
  });

  test('prefers default export over named export', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'NamedSeeder', run: async () => {} };
export default { name: 'DefaultSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(1);
    expect(result.seeders[0].seeder.name).toBe('DefaultSeeder');
  });
});

describe('validation', () => {
  test('accepts valid seeder with name and run', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects seeder without name', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('name');
  });

  test('rejects seeder with empty name', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: '', run: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('non-empty');
  });

  test('rejects seeder without run function', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    // Without a `run` function, the object is not recognized as seeder-like
    // by isSeederLike(), so findSeederExport() returns null
    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder' };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('No valid seeder export found');
  });

  test('rejects when dependencies is not array', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {}, dependencies: 'invalid' };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('dependencies');
  });

  test('rejects when environments is not array', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {}, environments: 'invalid' };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('environments');
  });

  test('rejects when truncate is not function', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {}, truncate: 'invalid' };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('truncate');
  });

  test('accepts seeder with optional truncate function', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {}, truncate: async () => {} };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.seeders[0].seeder.truncate).toBeDefined();
  });

  test('accepts seeder with dependencies array', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {}, dependencies: ['RoleSeeder'] };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.seeders[0].seeder.dependencies).toEqual(['RoleSeeder']);
  });

  test('accepts seeder with environments array', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {}, environments: ['development', 'test'] };`
    );

    const result = await loadSeeders(tempDir);

    expect(result.seeders).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.seeders[0].seeder.environments).toEqual(['development', 'test']);
  });
});

describe('getSeederFiles', () => {
  test('returns all seeder file paths', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );
    await createSeederFile(
      seedersDir,
      'post.seeder.ts',
      `export const PostSeeder = { name: 'PostSeeder', run: async () => {} };`
    );

    const files = await getSeederFiles(tempDir);

    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith('UserSeeder.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('post.seeder.ts'))).toBe(true);
  });

  test('excludes skipped files (index.ts, DatabaseSeeder.ts)', async () => {
    const seedersDir = await createSeedersDirectory(tempDir);

    await createSeederFile(seedersDir, 'index.ts', `export * from './UserSeeder';`);
    await createSeederFile(
      seedersDir,
      'DatabaseSeeder.ts',
      `export const DatabaseSeeder = { name: 'DatabaseSeeder', run: async () => {} };`
    );
    await createSeederFile(
      seedersDir,
      'UserSeeder.ts',
      `export const UserSeeder = { name: 'UserSeeder', run: async () => {} };`
    );

    const files = await getSeederFiles(tempDir);

    expect(files).toHaveLength(1);
    expect(files[0]).toContain('UserSeeder.ts');
  });

  test('returns empty array when directory does not exist', async () => {
    const files = await getSeederFiles(tempDir);

    expect(files).toEqual([]);
  });
});
