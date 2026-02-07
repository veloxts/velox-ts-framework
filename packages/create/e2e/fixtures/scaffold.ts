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
  /** Frontend dev server URL (same as baseURL for RSC templates) */
  webURL: string;
  /** Port the server is running on */
  port: number;
  /** Frontend dev server port (same as port for RSC templates) */
  webPort: number;
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

// Web (Vite) dev server ports - RSC uses same port as API (Vinxi serves both)
const WEB_PORTS: Record<TemplateType, number> = {
  spa: 3531,
  auth: 3532,
  trpc: 3533,
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
      // For non-RSC templates, also check the web server is running
      const isRSC = template === 'rsc' || template === 'rsc-auth';
      const webPort = WEB_PORTS[template];
      if (!isRSC && webPort !== port) {
        try {
          const webResponse = await fetch(`http://localhost:${webPort}`, {
            signal: AbortSignal.timeout(2000),
          });
          if (!webResponse.ok) {
            return { running: false };
          }
        } catch {
          return { running: false };
        }
      }

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

  const webPort = WEB_PORTS[template];

  // Check if server is already running (from a previous test in this file)
  const serverStatus = await isServerRunning(port, template);
  if (serverStatus.running) {
    console.log(`[${template}] Server already running on port ${port}`);
    return {
      baseURL: `http://localhost:${port}`,
      webURL: isRSC ? `http://localhost:${port}` : `http://localhost:${webPort}`,
      port,
      webPort: isRSC ? port : webPort,
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
  try {
    execSync(
      `SKIP_INSTALL=true node "${SCRIPT_DIR}/dist/cli.js" "${projectName}" --template="${template}" --database="sqlite"`,
      {
        cwd: TEST_BASE_DIR,
        stdio: 'pipe',
      }
    );
  } catch (error) {
    const execError = error as { stderr?: Buffer; stdout?: Buffer };
    console.error(`Scaffolder failed for ${template}:`);
    if (execError.stderr) console.error(execError.stderr.toString());
    if (execError.stdout) console.error(execError.stdout.toString());
    throw error;
  }

  // Verify scaffolding succeeded by checking expected files exist
  const expectedFile = isRSC
    ? resolve(projectPath, 'package.json')
    : resolve(projectPath, 'apps/api/package.json');

  if (!existsSync(expectedFile)) {
    throw new Error(
      `Scaffolding failed: expected file not found: ${expectedFile}\n` +
        `Template: ${template}, Project: ${projectPath}`
    );
  }

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

    // Patch vite.config.ts to use correct API port for proxy and web port for dev server
    const viteConfigPath = resolve(projectPath, 'apps/web/vite.config.ts');
    if (existsSync(viteConfigPath)) {
      let viteConfig = readFileSync(viteConfigPath, 'utf8');
      // Replace the default API port (3030) with the test port
      viteConfig = viteConfig.replace(
        /target:\s*['"]http:\/\/localhost:3030['"]/,
        `target: 'http://localhost:${port}'`
      );
      // Replace the default web port (8080) with the test web port
      viteConfig = viteConfig.replace(/port:\s*8080/, `port: ${webPort}`);
      writeFileSync(viteConfigPath, viteConfig);
    }
  }

  // Install dependencies with retry logic
  const installCwd = isRSC ? projectPath : resolve(projectPath, 'apps/api');
  console.log('Installing dependencies...');

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Clean node_modules to avoid corruption from previous failed attempts
      const nodeModulesPath = resolve(installCwd, 'node_modules');
      if (existsSync(nodeModulesPath)) {
        execSync(`rm -rf "${nodeModulesPath}"`, { stdio: 'pipe' });
      }
      // Also clean root node_modules for workspace templates (packages get hoisted)
      if (!isRSC) {
        const rootNodeModules = resolve(projectPath, 'node_modules');
        if (existsSync(rootNodeModules)) {
          execSync(`rm -rf "${rootNodeModules}"`, { stdio: 'pipe' });
        }
      }

      // Run npm install with explicit shell to avoid spawn issues
      execSync('npm install --legacy-peer-deps', {
        cwd: installCwd,
        stdio: 'pipe',
        shell: '/bin/bash',
        env: { ...process.env, npm_config_fund: 'false', npm_config_audit: 'false' },
      });

      // Success - break out of retry loop
      lastError = null;
      break;
    } catch (error) {
      lastError = error as Error;
      const execError = error as { stderr?: Buffer; stdout?: Buffer };
      console.warn(`npm install attempt ${attempt}/${maxRetries} failed for ${template}:`);
      if (execError.stderr) console.warn(execError.stderr.toString().slice(0, 500));

      if (attempt < maxRetries) {
        console.log(`Retrying in 2 seconds...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  // Create .env file for RSC templates
  if (isRSC) {
    const envExamplePath = resolve(projectPath, '.env.example');
    const envPath = resolve(projectPath, '.env');
    if (existsSync(envExamplePath)) {
      copyFileSync(envExamplePath, envPath);
    }
  }

  // Generate Prisma client and push schema (with retry for transient failures)
  console.log('Setting up database...');
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      execSync('npx prisma generate', { cwd: installCwd, stdio: 'pipe', shell: '/bin/bash' });
      execSync('npx prisma db push', { cwd: installCwd, stdio: 'pipe', shell: '/bin/bash' });
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      console.warn(`Prisma setup attempt ${attempt} failed, retrying...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

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

  // Start Vite dev server for non-RSC templates (SPA, auth, tRPC)
  if (!isRSC) {
    const webCwd = resolve(projectPath, 'apps/web');
    console.log('Installing web dependencies...');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const webNodeModules = resolve(webCwd, 'node_modules');
        if (existsSync(webNodeModules)) {
          execSync(`rm -rf "${webNodeModules}"`, { stdio: 'pipe' });
        }
        execSync('npm install --legacy-peer-deps', {
          cwd: webCwd,
          stdio: 'pipe',
          shell: '/bin/bash',
          env: { ...process.env, npm_config_fund: 'false', npm_config_audit: 'false' },
        });
        break;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        console.warn(`Web npm install attempt ${attempt}/${maxRetries} failed, retrying...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    console.log(`Starting Vite dev server on port ${webPort}...`);
    const viteProcess = spawn('npx', ['vite', '--port', String(webPort)], {
      cwd: webCwd,
      env: { ...process.env },
      stdio: 'pipe',
      detached: true,
    });
    viteProcess.unref();

    viteProcess.stdout?.on('data', (data: Buffer) => {
      if (process.env.DEBUG) {
        console.log(`[vite stdout] ${data}`);
      }
    });
    viteProcess.stderr?.on('data', (data: Buffer) => {
      if (process.env.DEBUG) {
        console.error(`[vite stderr] ${data}`);
      }
    });

    // Wait for Vite to be ready
    const viteMaxWait = 30000;
    const viteStartTime = Date.now();
    let viteReady = false;

    console.log(`Waiting for Vite dev server (http://localhost:${webPort})...`);

    while (Date.now() - viteStartTime < viteMaxWait) {
      try {
        const response = await fetch(`http://localhost:${webPort}`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok || response.status === 304) {
          viteReady = true;
          break;
        }
      } catch {
        // Vite not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!viteReady) {
      viteProcess.kill('SIGTERM');
      throw new Error(`Vite dev server failed to start within ${viteMaxWait / 1000}s`);
    }

    console.log(`Vite dev server ready on port ${webPort}\n`);
  }

  return {
    baseURL: `http://localhost:${port}`,
    webURL: isRSC ? `http://localhost:${port}` : `http://localhost:${webPort}`,
    port,
    webPort: isRSC ? port : webPort,
    template,
    projectPath,
    isRSC,
  };
}

// Create custom test fixture with worker scope
// This ensures the fixture is created once per worker (i.e., once per template)
// and reused across all tests in that template's spec file.
// Cleanup is handled by global-teardown.ts
export const test = base.extend<object, { scaffold: ScaffoldFixture }>({
  scaffold: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring syntax in fixtures
    async ({}, use, workerInfo) => {
      // Get template from the project name (set in playwright.config.ts)
      const projectName = workerInfo.project.name as TemplateType;
      const template = projectName || 'spa';

      console.log(
        `\n[Worker ${workerInfo.workerIndex}] Setting up fixture for ${template} template`
      );

      // Get or create the fixture
      const fixture = await getOrCreateFixture(template);

      await use(fixture);

      // No cleanup here - global-teardown handles it
      console.log(
        `[Worker ${workerInfo.workerIndex}] Fixture teardown for ${template} (server kept alive)`
      );
    },
    { scope: 'worker' },
  ],
});

export { expect };
