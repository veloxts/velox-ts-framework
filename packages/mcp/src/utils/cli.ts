/**
 * CLI Resolution Utilities
 *
 * Utilities for finding and executing the VeloxTS CLI binary.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolved CLI command information
 */
export interface ResolvedCLI {
  /** Command to execute (binary path, 'node', or 'npx') */
  command: string;
  /** Arguments to pass (includes binary path if using node, or '@veloxts/cli' if using npx) */
  args: string[];
  /** Whether we're using npx fallback */
  isNpx: boolean;
}

/**
 * Common locations to search for CLI binary in workspace projects
 */
const WORKSPACE_BIN_LOCATIONS = [
  // Root node_modules (CLI installed at workspace root - recommended)
  ['node_modules', '.bin'],
  // Legacy: apps/api (older templates had CLI in apps/api)
  ['apps', 'api', 'node_modules', '.bin'],
];

/**
 * Common locations to search for @veloxts/cli package
 */
const WORKSPACE_PKG_LOCATIONS = [
  // Root node_modules
  ['node_modules', '@veloxts', 'cli'],
  // Legacy: apps/api
  ['apps', 'api', 'node_modules', '@veloxts', 'cli'],
];

/**
 * Resolve the VeloxTS CLI binary path with smart fallbacks
 *
 * Resolution order:
 * 1. Local node_modules/.bin/velox (fastest, respects local version)
 * 2. Workspace locations (apps/api for legacy projects)
 * 3. Windows .cmd wrapper variants
 * 4. Resolve @veloxts/cli package and find bin entry
 * 5. Fallback to npx @veloxts/cli (slowest, downloads if needed)
 */
export function resolveVeloxCLI(projectRoot: string, args: string[]): ResolvedCLI {
  const isWindows = process.platform === 'win32';
  const binName = isWindows ? 'velox.cmd' : 'velox';

  // 1-3. Try all workspace bin locations
  for (const location of WORKSPACE_BIN_LOCATIONS) {
    const binPath = join(projectRoot, ...location, binName);
    if (existsSync(binPath)) {
      return {
        command: binPath,
        args,
        isNpx: false,
      };
    }
  }

  // 4. Try resolving @veloxts/cli package directly from workspace locations
  for (const location of WORKSPACE_PKG_LOCATIONS) {
    try {
      const cliPackageJson = join(projectRoot, ...location, 'package.json');
      if (existsSync(cliPackageJson)) {
        const pkg = JSON.parse(readFileSync(cliPackageJson, 'utf-8')) as {
          bin?: string | { velox?: string };
        };

        const binRelative = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.velox;

        if (binRelative) {
          const binPath = join(projectRoot, ...location, binRelative);
          if (existsSync(binPath)) {
            return {
              command: 'node',
              args: [binPath, ...args],
              isNpx: false,
            };
          }
        }
      }
    } catch {
      // Ignore resolution errors, try next location
    }
  }

  // 5. Fallback to npx (works even if not installed locally)
  return {
    command: 'npx',
    args: ['@veloxts/cli', ...args],
    isNpx: true,
  };
}
