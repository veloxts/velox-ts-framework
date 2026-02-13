/**
 * Dev command - Start development server with hot reload
 *
 * Inspired by Laravel's `php artisan serve` and Vite's dev server.
 *
 * By default, uses Hot Module Replacement (HMR) for fast reloads.
 * Use --no-hmr for legacy tsx watch mode with full process restarts.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

import { buildWatchArgs, runHMRServer } from '../dev/index.js';
import {
  error,
  formatCommand,
  formatPath,
  info,
  instruction,
  printBanner,
  success,
} from '../utils/output.js';
import {
  detectProjectType,
  discoverEntryPoints,
  findApiPackageRoot,
  findEntryPoint,
  findWebPackageRoot,
  isVeloxProject,
  isWorkspaceRoot,
  validateEntryPath,
} from '../utils/paths.js';

interface DevOptions {
  port?: string;
  host?: string;
  entry?: string;
  clear?: boolean;
  hmr?: boolean;
  verbose?: boolean;
  debug?: boolean;
  all?: boolean;
}

/**
 * Create the dev command
 */
export function createDevCommand(version: string): Command {
  return new Command('dev')
    .description('Start the development server with hot module replacement')
    .option('-p, --port <port>', 'Port to listen on', '3030')
    .option('-H, --host <host>', 'Host to bind to', 'localhost')
    .option('-e, --entry <file>', 'Entry point file (auto-detected if not specified)')
    .option('--clear', 'Clear console on restart (default: true)', true)
    .option('--no-clear', 'Disable console clearing on restart')
    .option('--hmr', 'Enable hot module replacement (default: true)', true)
    .option('--no-hmr', 'Disable HMR and use legacy tsx watch mode')
    .option('-v, --verbose', 'Show detailed timing and reload information', false)
    .option('-d, --debug', 'Enable debug logging and request tracing', false)
    .option('--all', 'Start both API and Web dev servers (workspace monorepos)', false)
    .action(async (options: DevOptions) => {
      await runDevServer(options, version);
    });
}

/**
 * Run Vinxi development server for RSC projects
 */
async function runVinxiServer(options: DevOptions, version: string): Promise<void> {
  // Print startup banner
  printBanner(version);

  const port = options.port || '3030';
  const host = options.host || 'localhost';

  info('Starting Vinxi development server...');
  console.log(`  ${pc.dim('React Server Components with file-based routing')}`);
  console.log('');

  // Set environment variables
  const env = {
    ...process.env,
    PORT: port,
    HOST: host,
    NODE_ENV: 'development',
  };

  // Spawn vinxi dev (use shell: false to avoid deprecation warning)
  const vinxiProcess = spawn('npx', ['vinxi', 'dev', '--port', port, '--host', host], {
    stdio: 'inherit',
    env,
  });

  // Handle process termination
  let isShuttingDown = false;

  const shutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n\n${pc.yellow('⚠')} ${pc.dim(`Received ${signal}, shutting down...`)}`);

    vinxiProcess.kill('SIGTERM');

    // Force kill after 5 seconds
    const forceKillTimeout = setTimeout(() => {
      console.log(pc.red('✗ Force killing process...'));
      vinxiProcess.kill('SIGKILL');
      process.exit(1);
    }, 5000);

    vinxiProcess.on('exit', () => {
      clearTimeout(forceKillTimeout);
      console.log(pc.dim('Vinxi server stopped.'));
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  vinxiProcess.on('error', (err) => {
    error(`Failed to start Vinxi server: ${err.message}`);
    instruction('Make sure vinxi is installed: pnpm add vinxi');
    process.exit(1);
  });

  vinxiProcess.on('exit', (code) => {
    if (!isShuttingDown && code !== 0) {
      error(`Vinxi server exited with code ${code}`);
      process.exit(code || 1);
    }
  });
}

/**
 * Spawn the web dev server in a workspace monorepo.
 * Runs `pnpm dev` inside apps/web/ with inherited stdio.
 * Returns the child process for lifecycle management.
 */
function spawnWebDevServer(webRoot: string): ReturnType<typeof spawn> {
  info(`Starting web dev server in ${formatPath(webRoot)}`);
  console.log(`  ${pc.dim('Running pnpm dev in apps/web/')}`);
  console.log('');

  return spawn('pnpm', ['dev'], {
    stdio: 'inherit',
    cwd: webRoot,
    env: { ...process.env, NODE_ENV: 'development' },
  });
}

/**
 * Run the development server
 */
async function runDevServer(options: DevOptions, version: string): Promise<void> {
  const cwd = process.cwd();
  const s = p.spinner();

  try {
    // Check if we're in a VeloxTS project (also check workspace subpackages)
    s.start('Checking project...');
    let isVelox = await isVeloxProject(cwd);

    // In a workspace root, @veloxts deps live in subpackages, not root
    if (!isVelox && isWorkspaceRoot(cwd)) {
      const apiRoot = findApiPackageRoot(cwd);
      if (apiRoot) {
        isVelox = await isVeloxProject(apiRoot);
      }
    }

    if (!isVelox) {
      s.stop('Project check failed');
      error('This does not appear to be a VeloxTS project.');
      instruction(`Run ${formatCommand('npx create-velox-app')} to create a new project.`);
      process.exit(1);
    }

    // Detect project type (API-only vs Vinxi/RSC)
    const projectType = await detectProjectType(cwd);

    if (projectType.isVinxi) {
      s.stop('Vinxi project detected');
      success('Detected VeloxTS full-stack project (RSC + Vinxi)');
      await runVinxiServer(options, version);
      return;
    }

    s.stop('API project validated');

    // Find and validate entry point
    let entryPoint: string;

    if (options.entry) {
      // User specified an entry point - validate it
      s.start('Validating entry point...');
      try {
        entryPoint = validateEntryPath(options.entry, cwd);
        s.stop(`Entry point: ${formatPath(entryPoint)}`);
      } catch (err) {
        s.stop('Invalid entry point');
        error(err instanceof Error ? err.message : 'Invalid entry point');
        process.exit(1);
      }
    } else {
      // Auto-detect entry point (workspace-aware via findEntryPoint)
      s.start('Detecting entry point...');
      const detected = findEntryPoint(cwd);

      if (detected) {
        entryPoint = detected;
        s.stop(`Entry point: ${formatPath(entryPoint)}`);
      } else {
        // Auto-detection failed — discover possible entry points and let user pick
        const candidates = discoverEntryPoints(cwd);

        if (candidates.length > 0) {
          s.stop('Multiple possible entry points found');
          const selected = await p.select({
            message: 'Select the entry point for your application',
            options: candidates.map((c) => ({
              value: c.absolute,
              label: c.relative,
            })),
          });

          if (p.isCancel(selected)) {
            p.cancel('Operation cancelled.');
            process.exit(0);
          }

          try {
            entryPoint = validateEntryPath(String(selected), cwd);
          } catch (err) {
            error(err instanceof Error ? err.message : 'Invalid entry point');
            process.exit(1);
          }

          success(`Using ${formatPath(entryPoint)}`);
        } else {
          s.stop('Entry point not found');
          error('Could not find any application entry point.');
          instruction('Create src/index.ts or specify one with --entry:');
          console.log(`  ${formatCommand('velox dev --entry src/index.ts')}`);
          process.exit(1);
        }
      }
    }

    // Determine the working directory for the child process.
    // In a workspace monorepo, the API server needs to run from apps/api/
    // so that dotenv/config loads apps/api/.env and Prisma finds its config.
    const apiRoot = findApiPackageRoot(cwd);
    const apiProcessCwd = apiRoot ?? cwd;

    if (apiRoot) {
      info(`Workspace detected — API root: ${formatPath(apiRoot)}`);
    }

    // Validate port and host
    const port = options.port || '3030';
    const host = options.host || 'localhost';

    // Validate port is a valid number
    const portNum = Number.parseInt(port, 10);
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      error(`Invalid port: ${port}. Port must be a number between 1 and 65535.`);
      process.exit(1);
    }

    // Validate host doesn't contain dangerous characters
    const validHostPattern = /^[a-zA-Z0-9.-]+$/;
    if (!validHostPattern.test(host)) {
      error(
        `Invalid host: ${host}. Host should only contain alphanumeric characters, dots, and dashes.`
      );
      process.exit(1);
    }

    // Print startup banner
    printBanner(version);

    // Set environment variables for the app
    const debug = options.debug ?? false;
    const env = {
      ...process.env,
      PORT: port,
      HOST: host,
      NODE_ENV: 'development',
      ...(debug && {
        LOG_LEVEL: 'debug',
        VELOX_REQUEST_LOGGING: 'true',
      }),
    };

    const clearScreen = options.clear !== false;
    const verbose = options.verbose ?? false;

    // --all: also start the web dev server in parallel
    let webProcess: ReturnType<typeof spawn> | null = null;
    let isShuttingDown = false;

    if (options.all) {
      // If we're in a subpackage (e.g., apps/api/), search from the parent workspace root
      let webSearchRoot = cwd;
      if (!isWorkspaceRoot(cwd)) {
        const parentDir = path.dirname(cwd);
        if (isWorkspaceRoot(parentDir)) {
          webSearchRoot = parentDir;
        }
        const grandparentDir = path.dirname(parentDir);
        if (!isWorkspaceRoot(parentDir) && isWorkspaceRoot(grandparentDir)) {
          webSearchRoot = grandparentDir;
        }
      }

      const webRoot = findWebPackageRoot(webSearchRoot);
      if (webRoot) {
        webProcess = spawnWebDevServer(webRoot);

        webProcess.on('error', (err) => {
          error(`Web dev server failed: ${err.message}`);
        });

        webProcess.on('exit', (code) => {
          if (!isShuttingDown && code !== 0) {
            console.log(pc.yellow(`  Web dev server exited with code ${code}`));
            console.log(pc.dim('  API server continues running.'));
          }
        });
      } else {
        info('No web package found — starting API only.');
      }
    }

    // Ensure the web process is cleaned up on exit (covers both HMR and legacy paths).
    // The 'exit' handler runs synchronously when process.exit() is called,
    // so SIGTERM is the best we can do (no async waiting).
    if (webProcess) {
      process.on('exit', () => {
        if (webProcess && !webProcess.killed) {
          webProcess.kill('SIGTERM');
        }
      });
    }

    // HMR is the default mode
    // Use --no-hmr for legacy tsx watch mode
    if (options.hmr !== false) {
      // Run with HMR (default)
      await runHMRServer({
        entry: entryPoint,
        port,
        host,
        env,
        verbose,
        debug,
        clearOnRestart: clearScreen,
        cwd: apiProcessCwd,
      });
      return; // HMR runner handles its own lifecycle
    }

    // Legacy mode: tsx watch with full process restarts
    info('Starting development server in legacy mode...');
    console.log(`  ${pc.dim('Using tsx watch - every change triggers full restart.')}`);
    console.log(`  ${pc.dim('Remove --no-hmr for faster reloads with HMR.')}`);
    console.log('');

    // Build watch arguments with smart ignore patterns
    const watchArgs = buildWatchArgs({
      entry: entryPoint,
      clearScreen,
    });

    // Spawn tsx in watch mode with optimized file watching
    const devProcess = spawn('npx', watchArgs, {
      stdio: 'inherit',
      env,
      cwd: apiProcessCwd,
    });

    // Handle process termination
    const shutdown = (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(
        `\n\n${pc.yellow('⚠')} ${pc.dim(`Received ${signal}, shutting down gracefully...`)}`
      );

      devProcess.kill('SIGTERM');
      webProcess?.kill('SIGTERM');

      // Force kill after 5 seconds if process doesn't exit
      const forceKillTimeout = setTimeout(() => {
        console.log(pc.red('✗ Force killing process...'));
        devProcess.kill('SIGKILL');
        webProcess?.kill('SIGKILL');
        process.exit(1);
      }, 5000);

      devProcess.on('exit', () => {
        clearTimeout(forceKillTimeout);
        console.log(pc.dim('Development server stopped.'));
        process.exit(0);
      });
    };

    // Handle Ctrl+C and other termination signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle dev process errors
    devProcess.on('error', (err) => {
      error(`Failed to start development server: ${err.message}`);
      process.exit(1);
    });

    devProcess.on('exit', (code) => {
      if (!isShuttingDown && code !== 0) {
        error(`Development server exited with code ${code}`);
        process.exit(code || 1);
      }
    });
  } catch (err) {
    s.stop('Failed to start development server');

    if (err instanceof Error) {
      error(err.message);

      // Provide helpful suggestions based on error
      if (err.message.includes('EADDRINUSE')) {
        instruction(`Port ${options.port} is already in use. Try a different port:`);
        console.log(`  ${formatCommand(`velox dev --port ${Number(options.port || 3030) + 1}`)}`);
      } else if (err.message.includes('EACCES')) {
        instruction('Permission denied. Try using a port above 1024.');
      }
    } else {
      error('An unknown error occurred');
    }

    process.exit(1);
  }
}
