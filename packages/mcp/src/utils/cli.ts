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
 * Resolve the VeloxTS CLI binary path with smart fallbacks
 *
 * Resolution order:
 * 1. Local node_modules/.bin/velox (fastest, respects local version)
 * 2. Windows .cmd wrapper (node_modules/.bin/velox.cmd)
 * 3. Resolve @veloxts/cli package and find bin entry
 * 4. Fallback to npx @veloxts/cli (slowest, downloads if needed)
 */
export function resolveVeloxCLI(projectRoot: string, args: string[]): ResolvedCLI {
  const isWindows = process.platform === 'win32';

  // 1. Try local .bin/velox (Unix)
  if (!isWindows) {
    const localBin = join(projectRoot, 'node_modules', '.bin', 'velox');
    if (existsSync(localBin)) {
      return {
        command: localBin,
        args,
        isNpx: false,
      };
    }
  }

  // 2. Try Windows .cmd wrapper
  if (isWindows) {
    const localBinCmd = join(projectRoot, 'node_modules', '.bin', 'velox.cmd');
    if (existsSync(localBinCmd)) {
      return {
        command: localBinCmd,
        args,
        isNpx: false,
      };
    }
  }

  // 3. Try resolving @veloxts/cli package directly
  try {
    const cliPackageJson = join(projectRoot, 'node_modules', '@veloxts', 'cli', 'package.json');
    if (existsSync(cliPackageJson)) {
      const pkg = JSON.parse(readFileSync(cliPackageJson, 'utf-8')) as {
        bin?: string | { velox?: string };
      };

      const binRelative = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.velox;

      if (binRelative) {
        const binPath = join(projectRoot, 'node_modules', '@veloxts', 'cli', binRelative);
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
    // Ignore resolution errors, fall through to npx
  }

  // 4. Fallback to npx (works even if not installed locally)
  return {
    command: 'npx',
    args: ['@veloxts/cli', ...args],
    isNpx: true,
  };
}
