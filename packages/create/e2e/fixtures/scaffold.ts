import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  /** Base URL of the running server */
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

// Port allocation for parallel tests (if we ever enable it)
const PORT_BASE = 3031;
let portCounter = 0;

function getNextPort(): number {
  return PORT_BASE + portCounter++;
}

// Active server process for cleanup
let activeServer: ChildProcess | null = null;
let activeProjectPath: string | null = null;

/**
 * Scaffold a VeloxTS project and start its dev server.
 *
 * @param template - Template to scaffold
 * @param port - Port to run the server on
 * @returns Fixture context
 */
async function scaffoldAndStart(template: TemplateType, port: number): Promise<ScaffoldFixture> {
  const projectName = `e2e-${template}-${Date.now()}`;
  const projectPath = resolve(TEST_BASE_DIR, projectName);
  const isRSC = template === 'rsc' || template === 'rsc-auth';

  console.log(`\n--- Scaffolding ${template} template ---`);
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
    const webPkgPath = resolve(projectPath, 'apps/web/package.json');

    const apiPkg = JSON.parse(readFileSync(apiPkgPath, 'utf8'));
    apiPkg.dependencies['@veloxts/velox'] = `file:${MONOREPO_ROOT}/packages/velox`;
    apiPkg.dependencies['@veloxts/core'] = `file:${MONOREPO_ROOT}/packages/core`;
    apiPkg.dependencies['@veloxts/router'] = `file:${MONOREPO_ROOT}/packages/router`;
    apiPkg.dependencies['@veloxts/validation'] = `file:${MONOREPO_ROOT}/packages/validation`;
    apiPkg.dependencies['@veloxts/orm'] = `file:${MONOREPO_ROOT}/packages/orm`;
    apiPkg.dependencies['@veloxts/auth'] = `file:${MONOREPO_ROOT}/packages/auth`;
    apiPkg.devDependencies['@veloxts/cli'] = `file:${MONOREPO_ROOT}/packages/cli`;
    writeFileSync(apiPkgPath, JSON.stringify(apiPkg, null, 2));

    const webPkg = JSON.parse(readFileSync(webPkgPath, 'utf8'));
    webPkg.dependencies['@veloxts/client'] = `file:${MONOREPO_ROOT}/packages/client`;
    writeFileSync(webPkgPath, JSON.stringify(webPkg, null, 2));
  }

  // Install dependencies
  const installCwd = isRSC ? projectPath : resolve(projectPath, 'apps/api');
  console.log('Installing dependencies...');
  execSync('npm install --legacy-peer-deps', {
    cwd: installCwd,
    stdio: 'pipe',
  });

  // For non-RSC templates, also install web dependencies
  if (!isRSC) {
    execSync('npm install --legacy-peer-deps', {
      cwd: resolve(projectPath, 'apps/web'),
      stdio: 'pipe',
    });
  }

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
    // Vinxi dev server
    serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: projectPath,
      env: { ...process.env, PORT: String(port) },
      stdio: 'pipe',
    });
    healthEndpoint = `http://localhost:${port}/api/health`;
  } else if (template === 'trpc') {
    // tRPC-only server (no REST)
    serverProcess = spawn('node', ['dist/index.js'], {
      cwd: installCwd,
      env: { ...process.env, PORT: String(port) },
      stdio: 'pipe',
    });
    healthEndpoint = `http://localhost:${port}/trpc/health.getHealth`;
  } else {
    // REST API server (spa, auth)
    serverProcess = spawn('node', ['dist/index.js'], {
      cwd: installCwd,
      env: { ...process.env, PORT: String(port) },
      stdio: 'pipe',
    });
    healthEndpoint = `http://localhost:${port}/api/health`;
  }

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

  // Store for cleanup
  activeServer = serverProcess;
  activeProjectPath = projectPath;

  // Wait for server to be ready
  const maxWait = 60000; // 60 seconds
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
 * Stop the server and clean up the project.
 */
async function cleanup(): Promise<void> {
  if (activeServer) {
    console.log('\n--- Cleaning up ---');
    activeServer.kill('SIGTERM');

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      if (activeServer) {
        activeServer.on('exit', () => resolve());
        setTimeout(resolve, 5000); // Force continue after 5s
      } else {
        resolve();
      }
    });

    activeServer = null;
  }

  if (activeProjectPath && existsSync(activeProjectPath)) {
    try {
      rmSync(activeProjectPath, { recursive: true, force: true });
      console.log('Project cleaned up\n');
    } catch {
      console.warn('Warning: Could not fully clean up project');
    }
    activeProjectPath = null;
  }
}

// Create custom test fixture
export const test = base.extend<{ scaffold: ScaffoldFixture }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures require empty pattern for dependency injection
  scaffold: async ({}, use, testInfo) => {
    // Extract template from test file name
    const fileName = testInfo.file.split('/').pop() ?? '';
    const templateMatch = fileName.match(/^(spa|auth|trpc|rsc-auth|rsc)\.spec\.ts$/);

    if (!templateMatch) {
      throw new Error(`Could not determine template from test file: ${fileName}`);
    }

    const template = templateMatch[1] as TemplateType;
    const port = getNextPort();

    const fixture = await scaffoldAndStart(template, port);

    await use(fixture);

    await cleanup();
  },
});

export { expect };
