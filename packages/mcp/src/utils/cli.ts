/**
 * CLI Resolution Utilities
 *
 * Utilities for finding and executing the VeloxTS CLI binary.
 */

import { spawn } from 'node:child_process';
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

// ============================================================================
// CLI Execution
// ============================================================================

/**
 * Result from spawning a CLI command
 */
export interface SpawnCLIResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * Spawn a VeloxTS CLI command and collect its output.
 *
 * Resolves the CLI binary, spawns the process, and returns stdout/stderr.
 * Never rejects - errors are returned in the result.
 */
export function spawnCLI(projectRoot: string, args: string[]): Promise<SpawnCLIResult> {
  const resolved = resolveVeloxCLI(projectRoot, args);

  return new Promise((resolve) => {
    const child = spawn(resolved.command, resolved.args, {
      cwd: projectRoot,
      shell: resolved.isNpx,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, stdout, stderr, code });
    });

    child.on('error', (err) => {
      resolve({ success: false, stdout, stderr: err.message, code: null });
    });
  });
}
