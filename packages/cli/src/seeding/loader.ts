/**
 * Seeder Loader
 *
 * Load seeder files from the filesystem.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { filesystemError, invalidExport } from './errors.js';
import type { LoadedSeeder, Seeder, SeederLoadResult } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default path for seeders relative to project root
 */
export const DEFAULT_SEEDERS_PATH = 'src/database/seeders';

/**
 * File patterns that indicate a seeder file
 */
const SEEDER_FILE_PATTERNS = [/Seeder\.(ts|js)$/, /\.seeder\.(ts|js)$/];

/**
 * Files to skip
 */
const SKIP_FILES = ['index.ts', 'index.js', 'DatabaseSeeder.ts', 'DatabaseSeeder.js'];

// ============================================================================
// Loader Functions
// ============================================================================

/**
 * Check if seeders directory exists.
 *
 * @param cwd - Project root directory
 * @param seedersPath - Path to seeders directory (relative to cwd)
 */
export async function seedersDirectoryExists(
  cwd: string,
  seedersPath: string = DEFAULT_SEEDERS_PATH
): Promise<boolean> {
  const fullPath = path.join(cwd, seedersPath);
  try {
    const stat = await fs.stat(fullPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Load all seeders from the filesystem.
 *
 * @param cwd - Project root directory
 * @param seedersPath - Path to seeders directory (relative to cwd)
 * @returns Load result with seeders and any errors
 */
export async function loadSeeders(
  cwd: string,
  seedersPath: string = DEFAULT_SEEDERS_PATH
): Promise<SeederLoadResult> {
  const fullPath = path.join(cwd, seedersPath);
  const seeders: LoadedSeeder[] = [];
  const errors: { filePath: string; error: string }[] = [];

  // Check directory exists
  if (!(await seedersDirectoryExists(cwd, seedersPath))) {
    return { seeders: [], errors: [] };
  }

  // List files
  let files: string[];
  try {
    files = await fs.readdir(fullPath);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw filesystemError('reading seeders directory', fullPath, err);
  }

  // Filter to seeder files
  const seederFiles = files.filter((file) => {
    // Skip non-seeder files
    if (SKIP_FILES.includes(file)) return false;

    // Check if matches seeder pattern
    return SEEDER_FILE_PATTERNS.some((pattern) => pattern.test(file));
  });

  // Load each seeder
  for (const file of seederFiles) {
    const filePath = path.join(fullPath, file);

    try {
      const seeder = await loadSeederFile(filePath);
      seeders.push({ seeder, filePath });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push({ filePath, error: err.message });
    }
  }

  return { seeders, errors };
}

/**
 * Load the main DatabaseSeeder entry point.
 *
 * @param cwd - Project root directory
 * @param seedersPath - Path to seeders directory (relative to cwd)
 * @returns DatabaseSeeder if found, null otherwise
 */
export async function loadDatabaseSeeder(
  cwd: string,
  seedersPath: string = DEFAULT_SEEDERS_PATH
): Promise<Seeder | null> {
  const fullPath = path.join(cwd, seedersPath);

  // Try both .ts and .js extensions
  for (const ext of ['ts', 'js']) {
    const filePath = path.join(fullPath, `DatabaseSeeder.${ext}`);

    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        return await loadSeederFile(filePath);
      }
    } catch {
      // File doesn't exist, try next
    }
  }

  return null;
}

/**
 * Load a single seeder file.
 *
 * @param filePath - Absolute path to seeder file
 * @returns Loaded seeder
 */
async function loadSeederFile(filePath: string): Promise<Seeder> {
  // Convert to file URL for dynamic import
  const fileUrl = pathToFileURL(filePath).href;

  // Dynamic import
  let module: Record<string, unknown>;
  try {
    module = (await import(fileUrl)) as Record<string, unknown>;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw invalidExport(filePath, `Failed to import: ${err.message}`);
  }

  // Look for seeder export
  const seeder = findSeederExport(module);

  if (!seeder) {
    throw invalidExport(
      filePath,
      'No valid seeder export found. Export a const named *Seeder or use default export.'
    );
  }

  // Validate seeder shape
  validateSeeder(seeder, filePath);

  return seeder;
}

/**
 * Find a seeder export in a module.
 */
function findSeederExport(module: Record<string, unknown>): Seeder | null {
  // Check default export first
  if (module.default && isSeederLike(module.default)) {
    return module.default as Seeder;
  }

  // Look for named export ending in 'Seeder'
  for (const [key, value] of Object.entries(module)) {
    if (key.endsWith('Seeder') && isSeederLike(value)) {
      return value as Seeder;
    }
  }

  return null;
}

/**
 * Check if a value looks like a seeder.
 */
function isSeederLike(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;
  return typeof obj.name === 'string' && typeof obj.run === 'function';
}

/**
 * Validate a seeder has the required shape.
 */
function validateSeeder(seeder: unknown, filePath: string): asserts seeder is Seeder {
  if (!seeder || typeof seeder !== 'object') {
    throw invalidExport(filePath, 'Seeder must be an object');
  }

  const obj = seeder as Record<string, unknown>;

  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    throw invalidExport(filePath, "Seeder must have a non-empty 'name' property");
  }

  if (typeof obj.run !== 'function') {
    throw invalidExport(filePath, "Seeder must have a 'run' function");
  }

  if (obj.dependencies !== undefined && !Array.isArray(obj.dependencies)) {
    throw invalidExport(filePath, "'dependencies' must be an array of strings");
  }

  if (obj.environments !== undefined && !Array.isArray(obj.environments)) {
    throw invalidExport(filePath, "'environments' must be an array");
  }

  if (obj.truncate !== undefined && typeof obj.truncate !== 'function') {
    throw invalidExport(filePath, "'truncate' must be a function");
  }
}

/**
 * Get all seeder file paths from directory.
 *
 * @param cwd - Project root directory
 * @param seedersPath - Path to seeders directory (relative to cwd)
 */
export async function getSeederFiles(
  cwd: string,
  seedersPath: string = DEFAULT_SEEDERS_PATH
): Promise<string[]> {
  const fullPath = path.join(cwd, seedersPath);

  if (!(await seedersDirectoryExists(cwd, seedersPath))) {
    return [];
  }

  const files = await fs.readdir(fullPath);

  return files
    .filter((file) => {
      if (SKIP_FILES.includes(file)) return false;
      return SEEDER_FILE_PATTERNS.some((pattern) => pattern.test(file));
    })
    .map((file) => path.join(fullPath, file));
}
