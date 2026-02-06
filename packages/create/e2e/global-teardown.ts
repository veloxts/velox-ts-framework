import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const TEST_BASE_DIR = '/tmp/velox-e2e-tests';

/**
 * Global teardown for Playwright E2E tests.
 *
 * - Kills any lingering server processes
 * - Cleans up the test directory
 */
export default async function globalTeardown(): Promise<void> {
  console.log('\n=== E2E Global Teardown ===\n');

  // Kill any servers that might still be running on common test ports
  // API ports: 3031-3035, Web (Vite) dev server ports: 3531-3533
  const testPorts = [3031, 3032, 3033, 3034, 3035, 3531, 3532, 3533];
  for (const port of testPorts) {
    try {
      execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, {
        stdio: 'pipe',
      });
    } catch {
      // Ignore errors - port might not have any process
    }
  }
  console.log('Killed lingering server processes\n');

  // Clean up test directory
  if (existsSync(TEST_BASE_DIR)) {
    console.log(`Removing test directory: ${TEST_BASE_DIR}`);
    try {
      rmSync(TEST_BASE_DIR, { recursive: true, force: true });
      console.log('Test directory removed\n');
    } catch (error) {
      console.warn('Warning: Could not fully clean test directory:', error);
    }
  }

  console.log('=== Global Teardown Complete ===\n');
}
