import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = resolve(__dirname, '..');
const MONOREPO_ROOT = resolve(SCRIPT_DIR, '../..');
const TEST_BASE_DIR = '/tmp/velox-e2e-tests';

/**
 * Global setup for Playwright E2E tests.
 *
 * - Builds the scaffolder
 * - Builds all monorepo packages
 * - Creates the test base directory
 */
export default async function globalSetup(): Promise<void> {
  console.log('\n=== E2E Global Setup ===\n');

  // Clean and create test base directory
  if (existsSync(TEST_BASE_DIR)) {
    console.log(`Cleaning existing test directory: ${TEST_BASE_DIR}`);
    rmSync(TEST_BASE_DIR, { recursive: true, force: true });
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
