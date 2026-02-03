import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test as base, expect } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = resolve(__dirname, '../..');
const MONOREPO_ROOT = resolve(SCRIPT_DIR, '../..');
const TEST_BASE_DIR = '/tmp/velox-e2e-tests';

// Template types
export type TemplateType = 'spa' | 'auth' | 'trpc' | 'rsc' | 'rsc-auth';

// Fixture context provided to each test
export interface ScaffoldFixture {
  /** Base URL of the running server (API for all, also serves frontend for RSC) */
  baseURL: string;
  /** Port the server is running on */
  port: number;
  /** Template type being tested */
  template: TemplateType;
  /** Path to the test project */
  projectPath: string;
  /** Whether this is an RSC template (single-package structure) */
  isRSC: boolean;
}

// Port allocation - each template gets a unique port
const TEMPLATE_PORTS: Record<TemplateType, number> = {
  spa: 3031,
  auth: 3032,
  trpc: 3033,
  rsc: 3034,
  'rsc-auth': 3035,
};

/**
 * Check if a server is already running on the given port.
 */
async function isServerRunning(
  port: number,
  template: TemplateType
): Promise<{ running: boolean; projectPath?: string }> {
  const healthEndpoint =
    template === 'trpc'
      ? `http://localhost:${port}/trpc/health.getHealth`
      : `http://localhost:${port}/api/health`;

  try {
    const response = await fetch(healthEndpoint, { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      // Find the project path from test directory
      const testDir = TEST_BASE_DIR;
      if (existsSync(testDir)) {
        const fs = await import('node:fs/promises');
        const entries = await fs.readdir(testDir);
        const projectDir = entries.find((e) => e.startsWith(`e2e-${template}-`));
        if (projectDir) {
          return { running: true, projectPath: resolve(testDir, projectDir) };
        }
      }
      return { running: true };
    }
  } catch {
    // Server not running
  }
  return { running: false };
}

/**
 * Scaffold a VeloxTS project and start its dev server.
 * Reuses existing server if one is already running on the expected port.
 *
 * @param template - Template to scaffold
 * @returns Fixture context
 */
async function getOrCreateFixture(template: TemplateType): Promise<ScaffoldFixture> {
  const port = TEMPLATE_PORTS[template];
  const isRSC = template === 'rsc' || template === 'rsc-auth';

  // Check if server is already running (from a previous test in this file)
  const serverStatus = await isServerRunning(port, template);
  if (serverStatus.running) {
    console.log(`[${template}] Server already running on port ${port}`);
    return {
      baseURL: `http://localhost:${port}`,
      port,
      template,
      projectPath: serverStatus.projectPath ?? '',
      isRSC,
    };
  }

  const projectName = `e2e-${template}-${Date.now()}`;
  const projectPath = resolve(TEST_BASE_DIR, projectName);

  console.log(`\n--- Scaffolding ${template} template (once per test file) ---`);
  console.log(`Project: ${projectPath}`);
  console.log(`Port: ${port}`);

  // Ensure test directory exists
  mkdirSync(TEST_BASE_DIR, { recursive: true });

  // Run scaffolder
  execSync(
    `SKIP_INSTALL=true node "${SCRIPT_DIR}/dist/cli.js" "${projectName}" --template="${template}" --database="sqlite"`,
    {
      cwd: TEST_BASE_DIR,
      stdio: 'pipe',
    }
  );

  // Link local packages
  if (isRSC) {
    // Single-package structure (rsc, rsc-auth)
    const pkgPath = resolve(projectPath, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    pkg.dependencies['@veloxts/core'] = `file:${MONOREPO_ROOT}/packages/core`;
    pkg.dependencies['@veloxts/router'] = `file:${MONOREPO_ROOT}/packages/router`;
    pkg.dependencies['@veloxts/validation'] = `file:${MONOREPO_ROOT}/packages/validation`;
    pkg.dependencies['@veloxts/orm'] = `file:${MONOREPO_ROOT}/packages/orm`;
    pkg.dependencies['@veloxts/web'] = `file:${MONOREPO_ROOT}/packages/web`;

    if (template === 'rsc-auth') {
      pkg.dependencies['@veloxts/auth'] = `file:${MONOREPO_ROOT}/packages/auth`;
    }

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  } else {
    // Workspace structure (spa, auth, trpc)
    const apiPkgPath = resolve(projectPath, 'apps/api/package.json');

    const apiPkg = JSON.parse(readFileSync(apiPkgPath, 'utf8'));
    apiPkg.dependencies['@veloxts/velox'] = `file:${MONOREPO_ROOT}/packages/velox`;
    apiPkg.dependencies['@veloxts/core'] = `file:${MONOREPO_ROOT}/packages/core`;
    apiPkg.dependencies['@veloxts/router'] = `file:${MONOREPO_ROOT}/packages/router`;
    apiPkg.dependencies['@veloxts/validation'] = `file:${MONOREPO_ROOT}/packages/validation`;
    apiPkg.dependencies['@veloxts/orm'] = `file:${MONOREPO_ROOT}/packages/orm`;
    apiPkg.dependencies['@veloxts/auth'] = `file:${MONOREPO_ROOT}/packages/auth`;
    apiPkg.devDependencies['@veloxts/cli'] = `file:${MONOREPO_ROOT}/packages/cli`;
    writeFileSync(apiPkgPath, JSON.stringify(apiPkg, null, 2));

    // Patch vite.config.ts to use correct API port for proxy
    const viteConfigPath = resolve(projectPath, 'apps/web/vite.config.ts');
    if (existsSync(viteConfigPath)) {
      let viteConfig = readFileSync(viteConfigPath, 'utf8');
      // Replace the default API port (3030) with the test port
      viteConfig = viteConfig.replace(
        /target:\s*['"]http:\/\/localhost:3030['"]/,
        `target: 'http://localhost:${port}'`
      );
      writeFileSync(viteConfigPath, viteConfig);
    }
  }

  // Install dependencies
  const installCwd = isRSC ? projectPath : resolve(projectPath, 'apps/api');
  console.log('Installing dependencies...');
  execSync('npm install --legacy-peer-deps', {
    cwd: installCwd,
    stdio: 'pipe',
  });

  // Create .env file for RSC templates
  if (isRSC) {
    const envExamplePath = resolve(projectPath, '.env.example');
    const envPath = resolve(projectPath, '.env');
    if (existsSync(envExamplePath)) {
      copyFileSync(envExamplePath, envPath);
    }
  }

  // Generate Prisma client and push schema
  console.log('Setting up database...');
  execSync('npx prisma generate', { cwd: installCwd, stdio: 'pipe' });
  execSync('npx prisma db push', { cwd: installCwd, stdio: 'pipe' });

  // Build for non-RSC templates
  if (!isRSC) {
    console.log('Building API...');
    execSync('npm run build', { cwd: installCwd, stdio: 'pipe' });
  }

  // Start the server
  console.log('Starting server...');
  let serverProcess: ChildProcess;
  let healthEndpoint: string;

  if (isRSC) {
    // Vinxi dev server - use npx directly with port arg (npm run dev has hardcoded port)
    serverProcess = spawn('npx', ['vinxi', 'dev', '--port', String(port)], {
      cwd: projectPath,
      env: { ...process.env },
      stdio: 'pipe',
      detached: true, // Allow server to outlive parent process
    });
    healthEndpoint = `http://localhost:${port}/api/health`;
  } else if (template === 'trpc') {
    // tRPC-only server (no REST)
    serverProcess = spawn('node', ['dist/index.js'], {
      cwd: installCwd,
      env: { ...process.env, PORT: String(port) },
      stdio: 'pipe',
      detached: true,
    });
    healthEndpoint = `http://localhost:${port}/trpc/health.getHealth`;
  } else {
    // REST API server (spa, auth)
    serverProcess = spawn('node', ['dist/index.js'], {
      cwd: installCwd,
      env: { ...process.env, PORT: String(port) },
      stdio: 'pipe',
      detached: true,
    });
    healthEndpoint = `http://localhost:${port}/api/health`;
  }

  // Unref to allow the parent process to exit while server keeps running
  serverProcess.unref();

  // Capture server output for debugging
  serverProcess.stdout?.on('data', (data) => {
    if (process.env.DEBUG) {
      console.log(`[server stdout] ${data}`);
    }
  });
  serverProcess.stderr?.on('data', (data) => {
    if (process.env.DEBUG) {
      console.error(`[server stderr] ${data}`);
    }
  });

  // Wait for server to be ready
  // RSC/Vinxi servers take longer to start (builds on first request)
  const maxWait = isRSC ? 90000 : 60000; // 90s for RSC, 60s for others
  const pollInterval = 1000;
  const startTime = Date.now();
  let serverReady = false;

  console.log(`Waiting for server (${healthEndpoint})...`);

  while (Date.now() - startTime < maxWait) {
    try {
      const response = await fetch(healthEndpoint);
      if (response.ok) {
        serverReady = true;
        break;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  if (!serverReady) {
    // Kill server and throw
    serverProcess.kill('SIGTERM');
    throw new Error(`Server failed to start within ${maxWait / 1000}s`);
  }

  console.log(`Server ready on port ${port}\n`);

  return {
    baseURL: `http://localhost:${port}`,
    port,
    template,
    projectPath,
    isRSC,
  };
}

/**
 * Extract template from test file name.
 */
function getTemplateFromFile(filePath: string): TemplateType {
  const fileName = filePath.split('/').pop() ?? '';
  const templateMatch = fileName.match(/^(spa|auth|trpc|rsc-auth|rsc)\.spec\.ts$/);

  if (!templateMatch) {
    throw new Error(`Could not determine template from test file: ${fileName}`);
  }

  return templateMatch[1] as TemplateType;
}

// Create custom test fixture
// Checks if server is already running before scaffolding
// Cleanup is handled by global-teardown.ts
export const test = base.extend<{ scaffold: ScaffoldFixture }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures require empty pattern for dependency injection
  scaffold: async ({}, use, testInfo) => {
    // Get template from the test file name
    const template = getTemplateFromFile(testInfo.file);

    // Get or create the fixture
    const fixture = await getOrCreateFixture(template);

    await use(fixture);

    // No cleanup here - global-teardown handles it
  },
});

export { expect };
