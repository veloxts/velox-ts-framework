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
