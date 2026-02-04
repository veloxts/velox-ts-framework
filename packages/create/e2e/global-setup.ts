import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = resolve(__dirname, '..');
const MONOREPO_ROOT = resolve(SCRIPT_DIR, '../..');
const TEST_BASE_DIR = '/tmp/velox-e2e-tests';

/**
 * Kill any lingering server processes from previous test runs.
 */
function killLingeringProcesses(): void {
  try {
    // Kill any node processes running on test ports (3031-3040)
    for (let port = 3031; port <= 3040; port++) {
      try {
        execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
      } catch {
        // Ignore errors - process may not exist
      }
    }
    // Small delay to let processes fully terminate
    execSync('sleep 0.5', { stdio: 'ignore' });
  } catch {
    // Ignore errors
  }
}

/**
 * Remove directory with retry logic for ENOTEMPTY errors.
 */
function removeDirectoryWithRetry(dir: string, maxRetries = 3): void {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      return; // Success
    } catch (error) {
      if (attempt === maxRetries) {
        // Last resort: use shell rm -rf which handles edge cases better on macOS
        try {
          execSync(`rm -rf "${dir}"`, { stdio: 'ignore' });
          return;
        } catch {
          throw error; // Re-throw original error if shell command also fails
        }
      }
      // Wait before retry
      execSync('sleep 0.5', { stdio: 'ignore' });
    }
  }
}

/**
 * Global setup for Playwright E2E tests.
 *
 * - Builds the scaffolder
 * - Builds all monorepo packages
 * - Creates the test base directory
 */
export default async function globalSetup(): Promise<void> {
  console.log('\n=== E2E Global Setup ===\n');

  // Kill any lingering processes from previous runs
  killLingeringProcesses();

  // Clean and create test base directory
  if (existsSync(TEST_BASE_DIR)) {
    console.log(`Cleaning existing test directory: ${TEST_BASE_DIR}`);
    removeDirectoryWithRetry(TEST_BASE_DIR);
  }
  mkdirSync(TEST_BASE_DIR, { recursive: true });
  console.log(`Created test directory: ${TEST_BASE_DIR}\n`);

  // Check if build artifacts already exist (from CI artifact download)
  const scaffolderDist = resolve(SCRIPT_DIR, 'dist/cli.js');
  if (existsSync(scaffolderDist)) {
    console.log('Build artifacts found, skipping build step');
    console.log('(Run `pnpm build` manually if needed)\n');
    return;
  }

  // Build scaffolder
  console.log('Building scaffolder...');
  execSync('pnpm build', {
    cwd: SCRIPT_DIR,
    stdio: 'inherit',
  });

  // Build all monorepo packages
  console.log('\nBuilding monorepo packages...');
  execSync('pnpm build', {
    cwd: MONOREPO_ROOT,
    stdio: 'inherit',
  });

  console.log('\n=== Global Setup Complete ===\n');
}
