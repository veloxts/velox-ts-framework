/**
 * Dev command - Start development server with hot reload
 *
 * Inspired by Laravel's `php artisan serve` and Vite's dev server.
 *
 * By default, uses Hot Module Replacement (HMR) for fast reloads.
 * Use --no-hmr for legacy tsx watch mode with full process restarts.
 */

import { spawn } from 'node:child_process';

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
} from '../utils/output.js';
import { findEntryPoint, isVeloxProject, validateEntryPath } from '../utils/paths.js';

interface DevOptions {
  port?: string;
  host?: string;
  entry?: string;
  clear?: boolean;
  hmr?: boolean;
  verbose?: boolean;
  debug?: boolean;
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
    .action(async (options: DevOptions) => {
      await runDevServer(options, version);
    });
}

/**
 * Run the development server
 */
async function runDevServer(options: DevOptions, version: string): Promise<void> {
  const s = p.spinner();

  try {
    // Check if we're in a VeloxTS project
    s.start('Checking project...');
    const isVelox = await isVeloxProject();

    if (!isVelox) {
      s.stop('Project check failed');
      error('This does not appear to be a VeloxTS project.');
      instruction(`Run ${formatCommand('npx create-velox-app')} to create a new project.`);
      process.exit(1);
    }
    s.stop('Project validated');

    // Find and validate entry point
    let entryPoint: string;

    if (options.entry) {
      // User specified an entry point - validate it
      s.start('Validating entry point...');
      try {
        entryPoint = validateEntryPath(options.entry);
        s.stop(`Entry point: ${formatPath(entryPoint)}`);
      } catch (err) {
        s.stop('Invalid entry point');
        error(err instanceof Error ? err.message : 'Invalid entry point');
        process.exit(1);
      }
    } else {
      // Auto-detect entry point
      s.start('Detecting entry point...');
      const detected = findEntryPoint();

      if (!detected) {
        s.stop('Entry point not found');
        error('Could not find application entry point.');
        instruction('Try specifying the entry point with --entry flag:');
        console.log(`  ${formatCommand('velox dev --entry src/index.ts')}`);
        process.exit(1);
      }

      entryPoint = detected;
      s.stop(`Entry point: ${formatPath(entryPoint)}`);
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
      shell: true,
    });

    // Handle process termination
    let isShuttingDown = false;

    const shutdown = (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(
        `\n\n${pc.yellow('⚠')} ${pc.dim(`Received ${signal}, shutting down gracefully...`)}`
      );

      devProcess.kill('SIGTERM');

      // Force kill after 5 seconds if process doesn't exit
      const forceKillTimeout = setTimeout(() => {
        console.log(pc.red('✗ Force killing process...'));
        devProcess.kill('SIGKILL');
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
