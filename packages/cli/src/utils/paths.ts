/**
 * Path utilities for finding project files
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Find the project entry point
 * Looks for common entry points in order of preference
 */
export function findEntryPoint(cwd: string = process.cwd()): string | null {
  const candidates = ['src/index.ts', 'src/main.ts', 'src/app.ts', 'index.ts', 'main.ts'];

  for (const candidate of candidates) {
    const fullPath = path.join(cwd, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
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
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    // Check if any @veloxts packages are in dependencies
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Object.keys(deps).some((dep) => dep.startsWith('@veloxts/'));
  } catch {
    return false;
  }
}
