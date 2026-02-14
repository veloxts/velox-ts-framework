/**
 * Path utilities for finding project files
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';

/** Common entry point file names, ordered by preference */
const ENTRY_POINT_PATTERNS = [
  'src/index.ts',
  'src/main.ts',
  'src/app.ts',
  'src/server.ts',
  'index.ts',
  'main.ts',
  'app.ts',
  'server.ts',
] as const;

/** Default workspace subdirectory names */
const WORKSPACE_DIRS = {
  APPS: 'apps',
  API: 'api',
  WEB: 'web',
} as const;

/** Directories excluded from the API package fallback scan */
const NON_API_PACKAGES = ['web', 'docs', 'landing'] as const;

/**
 * Find the project entry point
 * Looks for common entry points in order of preference.
 * If nothing is found in cwd and cwd is a workspace root,
 * also searches inside the API package (apps/api/).
 */
export function findEntryPoint(cwd: string = process.cwd()): string | null {
  // 1. Try flat candidates in cwd (preserves existing behavior)
  for (const candidate of ENTRY_POINT_PATTERNS) {
    const fullPath = path.join(cwd, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  // 2. If workspace detected, search inside the API package root
  const apiRoot = findApiPackageRoot(cwd);
  if (apiRoot) {
    for (const candidate of ENTRY_POINT_PATTERNS) {
      const fullPath = path.join(apiRoot, candidate);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

/**
 * Check if a directory is a pnpm/npm/yarn workspace root.
 * Looks for pnpm-workspace.yaml or "workspaces" in package.json.
 */
export function isWorkspaceRoot(cwd: string): boolean {
  // Check pnpm-workspace.yaml
  if (existsSync(path.join(cwd, 'pnpm-workspace.yaml'))) {
    return true;
  }

  // Check package.json "workspaces" field (npm/yarn)
  const pkgPath = path.join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.workspaces) {
        return true;
      }
    } catch {
      // Ignore parse errors
    }
  }

  return false;
}

/**
 * Check if a package.json has @veloxts/* dependencies
 */
function hasVeloxDeps(pkgJsonPath: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Object.keys(deps).some((dep) => dep.startsWith('@veloxts/'));
  } catch {
    return false;
  }
}

/**
 * Find the API package root in a workspace monorepo.
 *
 * 1. Checks if cwd is a workspace root
 * 2. Looks for apps/api/package.json with @veloxts/* deps
 * 3. Falls back to scanning apps/* for any package with @veloxts/* deps
 *
 * Returns the absolute path to the API package root, or null.
 */
export function findApiPackageRoot(cwd: string = process.cwd()): string | null {
  if (!isWorkspaceRoot(cwd)) {
    return null;
  }

  // Primary: apps/api/
  const primaryApiDir = path.join(cwd, WORKSPACE_DIRS.APPS, WORKSPACE_DIRS.API);
  const primaryApiPkg = path.join(primaryApiDir, 'package.json');
  if (existsSync(primaryApiPkg) && hasVeloxDeps(primaryApiPkg)) {
    return primaryApiDir;
  }

  // Fallback: scan apps/*/package.json for first package with @veloxts/* deps
  const appsDir = path.join(cwd, WORKSPACE_DIRS.APPS);
  if (existsSync(appsDir)) {
    try {
      const entries = readdirSync(appsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !(NON_API_PACKAGES as readonly string[]).includes(entry.name)) {
          const pkgPath = path.join(appsDir, entry.name, 'package.json');
          if (existsSync(pkgPath) && hasVeloxDeps(pkgPath)) {
            return path.join(appsDir, entry.name);
          }
        }
      }
    } catch {
      // Ignore scan errors
    }
  }

  return null;
}

/**
 * Find the Web package root in a workspace monorepo.
 *
 * Looks for apps/web/package.json with vite, @veloxts/web, or react in deps.
 *
 * Returns the absolute path to the Web package root, or null.
 */
export function findWebPackageRoot(cwd: string = process.cwd()): string | null {
  if (!isWorkspaceRoot(cwd)) {
    return null;
  }

  const webDir = path.join(cwd, WORKSPACE_DIRS.APPS, WORKSPACE_DIRS.WEB);
  const webPkgPath = path.join(webDir, 'package.json');
  if (!existsSync(webPkgPath)) {
    return null;
  }

  try {
    const pkg = JSON.parse(readFileSync(webPkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const webMarkers = ['vite', '@veloxts/web', 'react', 'next', 'vinxi'];
    if (webMarkers.some((marker) => marker in deps)) {
      return webDir;
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

/**
 * Discover potential entry point files in the project.
 *
 * Scans cwd and, in workspaces, each apps/* subpackage for TypeScript files
 * that look like entry points (index.ts, main.ts, server.ts, app.ts in src/ or root).
 *
 * Returns paths relative to cwd for display, paired with absolute paths.
 */
export function discoverEntryPoints(
  cwd: string = process.cwd()
): Array<{ absolute: string; relative: string }> {
  const results: Array<{ absolute: string; relative: string }> = [];
  const seen = new Set<string>();

  const scanDir = (dir: string) => {
    for (const candidate of ENTRY_POINT_PATTERNS) {
      const fullPath = path.normalize(path.join(dir, candidate));
      if (existsSync(fullPath) && !seen.has(fullPath)) {
        seen.add(fullPath);
        results.push({
          absolute: fullPath,
          relative: path.relative(cwd, fullPath),
        });
      }
    }
  };

  // Scan cwd itself
  scanDir(cwd);

  // In workspaces, scan the detected API package root (not all apps/*)
  if (isWorkspaceRoot(cwd)) {
    const apiRoot = findApiPackageRoot(cwd);
    if (apiRoot && apiRoot !== cwd) {
      scanDir(apiRoot);
    }
  }

  return results;
}

/**
 * Check if a file exists at the given path
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Get the absolute path from a relative path
 */
export function getAbsolutePath(relativePath: string, cwd: string = process.cwd()): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(cwd, relativePath);
}

/**
 * Validate that a path is safe for use in shell commands
 *
 * This prevents command injection attacks by ensuring:
 * 1. Path is within the current working directory (no path traversal)
 * 2. Path doesn't contain shell metacharacters
 * 3. File exists and is a TypeScript/JavaScript file
 *
 * @param filePath - The path to validate
 * @param cwd - The current working directory
 * @returns The normalized, validated path
 * @throws Error if the path is invalid or unsafe
 */
export function validateEntryPath(filePath: string, cwd: string = process.cwd()): string {
  // Normalize the path to resolve any .. or . segments
  const absolutePath = path.isAbsolute(filePath)
    ? path.normalize(filePath)
    : path.normalize(path.join(cwd, filePath));

  // Ensure the path is within the current working directory
  const normalizedCwd = path.normalize(cwd);
  if (!absolutePath.startsWith(normalizedCwd)) {
    throw new Error(
      `Entry path must be within the project directory. ` +
        `Got: ${filePath}, which resolves to: ${absolutePath}`
    );
  }

  // Check for dangerous shell characters that could enable command injection
  const dangerousChars = /[;&|`$(){}[\]<>!#*?\\'"\n\r\t]/;
  if (dangerousChars.test(filePath)) {
    throw new Error(
      `Entry path contains invalid characters. ` +
        `Path should only contain alphanumeric characters, slashes, dots, and dashes.`
    );
  }

  // Verify the file exists
  if (!existsSync(absolutePath)) {
    throw new Error(`Entry point file not found: ${absolutePath}`);
  }

  // Verify it's a TypeScript or JavaScript file
  const ext = path.extname(absolutePath).toLowerCase();
  const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs'];
  if (!validExtensions.includes(ext)) {
    throw new Error(
      `Entry point must be a TypeScript or JavaScript file. Got: ${ext || 'no extension'}`
    );
  }

  return absolutePath;
}

/**
 * Check if we're in a VeloxTS project
 * Looks for package.json with @veloxts dependencies
 */
export async function isVeloxProject(cwd: string = process.cwd()): Promise<boolean> {
  const packageJsonPath = path.join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    // Check if any @veloxts packages are in dependencies
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Object.keys(deps).some((dep) => dep.startsWith('@veloxts/'));
  } catch {
    return false;
  }
}

/**
 * Markers that indicate a Vinxi/RSC project
 */
const VINXI_PROJECT_MARKERS = ['vinxi', '@vinxi/server-functions', '@veloxts/web'] as const;

/**
 * Project type detection result
 */
export interface ProjectType {
  /** Whether this is a Vinxi-based RSC project */
  isVinxi: boolean;
  /** Whether @veloxts/web is installed */
  hasWeb: boolean;
  /** All dependencies (for debugging) */
  dependencies: Record<string, string>;
}

/**
 * Detect the project type (API-only vs Vinxi/RSC full-stack)
 *
 * Checks for:
 * 1. Vinxi markers in dependencies (vinxi, @vinxi/server-functions, @veloxts/web)
 * 2. app.config.ts or app.config.js (Vinxi configuration)
 */
export async function detectProjectType(cwd: string = process.cwd()): Promise<ProjectType> {
  const packageJsonPath = path.join(cwd, 'package.json');

  const result: ProjectType = {
    isVinxi: false,
    hasWeb: false,
    dependencies: {},
  };

  // Check for app.config.ts/js (Vinxi config file)
  const hasAppConfig =
    existsSync(path.join(cwd, 'app.config.ts')) || existsSync(path.join(cwd, 'app.config.js'));

  if (!existsSync(packageJsonPath)) {
    // No package.json, but might have app.config
    result.isVinxi = hasAppConfig;
    return result;
  }

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    // Collect all dependencies
    result.dependencies = { ...pkg.dependencies, ...pkg.devDependencies };

    // Check for Vinxi markers
    const hasVinxiMarker = VINXI_PROJECT_MARKERS.some((marker) => marker in result.dependencies);

    // Check for @veloxts/web specifically
    result.hasWeb = '@veloxts/web' in result.dependencies;

    // Project is Vinxi if it has markers OR app.config
    result.isVinxi = hasVinxiMarker || hasAppConfig;

    return result;
  } catch {
    // Error reading package.json, fall back to app.config check
    result.isVinxi = hasAppConfig;
    return result;
  }
}

/**
 * Read and parse a JSON file
 */
export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Write a JSON file with pretty formatting
 */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Create a directory recursively
 */
export function createDirectory(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

/**
 * Load environment variables from .env file if present
 */
export function loadEnvironment(cwd: string = process.cwd()): void {
  const envPath = path.resolve(cwd, '.env');
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
  }
}
