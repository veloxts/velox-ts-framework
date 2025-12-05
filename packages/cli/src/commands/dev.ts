/**
 * Dev command - Start development server with hot reload
 *
 * Inspired by Laravel's `php artisan serve` and Vite's dev server
 */

import { spawn } from 'node:child_process';

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

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
}

/**
 * Create the dev command
 */
export function createDevCommand(version: string): Command {
  return new Command('dev')
    .description('Start the development server with hot reload')
    .option('-p, --port <port>', 'Port to listen on', '3210')
    .option('-H, --host <host>', 'Host to bind to', 'localhost')
    .option('-e, --entry <file>', 'Entry point file (auto-detected if not specified)')
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
    const port = options.port || '3210';
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
    info('Starting development server...');
    console.log('');

    // Set environment variables for the app
    const env = {
      ...process.env,
      PORT: port,
      HOST: host,
      NODE_ENV: 'development',
    };

    // Spawn tsx in watch mode
    const devProcess = spawn('npx', ['tsx', 'watch', entryPoint], {
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
        console.log(`  ${formatCommand(`velox dev --port ${Number(options.port || 3210) + 1}`)}`);
      } else if (err.message.includes('EACCES')) {
        instruction('Permission denied. Try using a port above 1024.');
      }
    } else {
      error('An unknown error occurred');
    }

    process.exit(1);
  }
}
