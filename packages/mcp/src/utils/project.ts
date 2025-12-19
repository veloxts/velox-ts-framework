/**
 * Project Detection Utilities
 *
 * Utilities for detecting and introspecting VeloxTS projects.
 */

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a detected VeloxTS project
 */
export interface ProjectInfo {
  /** Absolute path to the project root */
  root: string;
  /** Project name from package.json */
  name: string;
  /** Project version from package.json */
  version: string;
  /** Whether this is a VeloxTS project */
  isVeloxProject: boolean;
  /** Path to the API app (if monorepo) */
  apiPath?: string;
  /** Path to the web app (if monorepo) */
  webPath?: string;
  /** Path to the procedures directory */
  proceduresPath?: string;
  /** Path to the schemas directory */
  schemasPath?: string;
  /** Path to the Prisma schema */
  prismaSchemaPath?: string;
}

/**
 * Package.json structure (partial)
 */
interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// ============================================================================
// Project Detection
// ============================================================================

/**
 * Detect if a directory contains a VeloxTS project
 */
export function isVeloxProject(dir: string): boolean {
  const packageJsonPath = join(dir, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content) as PackageJson;

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for any VeloxTS package
    return Object.keys(deps).some((dep) => dep.startsWith('@veloxts/'));
  } catch {
    return false;
  }
}

/**
 * Find the project root by searching up from a starting directory
 */
export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let current = resolve(startDir);
  const root = resolve('/');

  while (current !== root) {
    if (existsSync(join(current, 'package.json'))) {
      if (isVeloxProject(current)) {
        return current;
      }
    }
    current = resolve(current, '..');
  }

  return null;
}

/**
 * Get comprehensive project information
 */
export async function getProjectInfo(projectRoot?: string): Promise<ProjectInfo | null> {
  const root = projectRoot ?? findProjectRoot();

  if (!root) {
    return null;
  }

  const packageJsonPath = join(root, 'package.json');

  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as PackageJson;

    const info: ProjectInfo = {
      root,
      name: packageJson.name ?? 'unknown',
      version: packageJson.version ?? '0.0.0',
      isVeloxProject: isVeloxProject(root),
    };

    // Check for monorepo structure (apps/api, apps/web)
    const apiPath = join(root, 'apps', 'api');
    const webPath = join(root, 'apps', 'web');

    if (existsSync(apiPath)) {
      info.apiPath = apiPath;
      info.proceduresPath = join(apiPath, 'src', 'procedures');
      info.schemasPath = join(apiPath, 'src', 'schemas');
      info.prismaSchemaPath = join(apiPath, 'prisma', 'schema.prisma');
    } else {
      // Single package structure
      info.proceduresPath = join(root, 'src', 'procedures');
      info.schemasPath = join(root, 'src', 'schemas');
      info.prismaSchemaPath = join(root, 'prisma', 'schema.prisma');
    }

    if (existsSync(webPath)) {
      info.webPath = webPath;
    }

    // Validate paths exist
    if (info.proceduresPath && !existsSync(info.proceduresPath)) {
      info.proceduresPath = undefined;
    }
    if (info.schemasPath && !existsSync(info.schemasPath)) {
      info.schemasPath = undefined;
    }
    if (info.prismaSchemaPath && !existsSync(info.prismaSchemaPath)) {
      info.prismaSchemaPath = undefined;
    }

    return info;
  } catch {
    return null;
  }
}

/**
 * Get the procedures directory path for a project
 */
export function getProceduresPath(projectRoot: string): string | null {
  // Check monorepo structure first
  const monorepoProcedures = join(projectRoot, 'apps', 'api', 'src', 'procedures');
  if (existsSync(monorepoProcedures)) {
    return monorepoProcedures;
  }

  // Check single package structure
  const singleProcedures = join(projectRoot, 'src', 'procedures');
  if (existsSync(singleProcedures)) {
    return singleProcedures;
  }

  return null;
}

/**
 * Get the schemas directory path for a project
 */
export function getSchemasPath(projectRoot: string): string | null {
  // Check monorepo structure first
  const monorepoSchemas = join(projectRoot, 'apps', 'api', 'src', 'schemas');
  if (existsSync(monorepoSchemas)) {
    return monorepoSchemas;
  }

  // Check single package structure
  const singleSchemas = join(projectRoot, 'src', 'schemas');
  if (existsSync(singleSchemas)) {
    return singleSchemas;
  }

  return null;
}
