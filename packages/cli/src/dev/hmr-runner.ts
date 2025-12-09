/**
 * HMR Runner - Experimental Hot Module Replacement
 *
 * Uses hot-hook library to enable module replacement without full process restart.
 * This is marked as experimental and may not work for all use cases.
 *
 * @see https://github.com/Julien-R44/hot-hook
 */

import { type ChildProcess, spawn } from 'node:child_process';

import pc from 'picocolors';

import { error, info, warning } from '../utils/output.js';

/**
 * Options for the HMR runner
 */
export interface HMRRunnerOptions {
  /** Entry point file */
  readonly entry: string;
  /** Port for the application */
  readonly port: string;
  /** Host for the application */
  readonly host: string;
  /** Environment variables to pass */
  readonly env?: Record<string, string>;
}

/**
 * HMR Runner manages a Node.js process with hot-hook enabled
 * for experimental hot module replacement.
 */
export class HMRRunner {
  private child: ChildProcess | null = null;
  private isShuttingDown = false;
  private restartCount = 0;

  constructor(private readonly options: HMRRunnerOptions) {}

  /**
   * Start the HMR-enabled development server
   */
  async start(): Promise<void> {
    this.printHMRBanner();
    await this.spawnProcess();
    this.setupSignalHandlers();
  }

  /**
   * Stop the HMR runner
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    if (this.child) {
      this.child.kill('SIGTERM');

      // Wait for graceful shutdown with timeout
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.child) {
            this.child.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.child?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }

  /**
   * Restart the process (used when HMR fails)
   */
  async restart(): Promise<void> {
    this.restartCount++;
    info(`Full restart triggered (restart #${this.restartCount})`);

    if (this.child) {
      this.child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        this.child?.on('exit', () => resolve());
        setTimeout(resolve, 2000);
      });
    }

    await this.spawnProcess();
  }

  private printHMRBanner(): void {
    console.log('');
    console.log(pc.yellow('  ⚡ HMR Mode (Experimental)'));
    console.log(pc.dim('  Hot module replacement enabled for:'));
    console.log(pc.dim('    • src/procedures/**/*.ts'));
    console.log(pc.dim('    • src/schemas/**/*.ts'));
    console.log(pc.dim('    • src/handlers/**/*.ts'));
    console.log('');
    console.log(pc.dim('  Config/database changes require full restart.'));
    console.log('');
  }

  private async spawnProcess(): Promise<void> {
    const env = {
      ...process.env,
      ...this.options.env,
      PORT: this.options.port,
      HOST: this.options.host,
      NODE_ENV: 'development',
      HOT_HOOK_ENABLED: 'true',
    };

    // Spawn with hot-hook register via Node.js loader
    // Note: tsx provides TypeScript support, hot-hook provides HMR
    this.child = spawn('node', ['--import=tsx', '--import=hot-hook/register', this.options.entry], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      env,
      cwd: process.cwd(),
    });

    // Handle IPC messages from hot-hook
    this.child.on('message', (message) => {
      if (typeof message === 'object' && message !== null) {
        const msg = message as { type?: string; file?: string; error?: string };

        if (msg.type === 'hot-hook:full-reload') {
          // Full reload requested by hot-hook (e.g., non-boundary file changed)
          this.restart().catch((err) => {
            error(`Failed to restart: ${err instanceof Error ? err.message : String(err)}`);
          });
        } else if (msg.type === 'hot-hook:error') {
          warning(`HMR error: ${msg.error ?? 'Unknown error'}`);
          warning('Falling back to full restart...');
          this.restart().catch((err) => {
            error(`Failed to restart: ${err instanceof Error ? err.message : String(err)}`);
          });
        } else if (msg.type === 'hot-hook:update') {
          console.log(pc.green('  ⚡ Hot updated:'), pc.dim(msg.file ?? 'unknown'));
        }
      }
    });

    this.child.on('error', (err) => {
      error(`Process error: ${err.message}`);
      if (!this.isShuttingDown) {
        this.restart().catch(() => {
          process.exit(1);
        });
      }
    });

    this.child.on('exit', (code) => {
      if (!this.isShuttingDown && code !== 0) {
        error(`Process exited with code ${code}`);
        // Don't auto-restart on crash - let developer fix the issue
      }
    });
  }

  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n${pc.yellow('⚠')} Received ${signal}, shutting down...`);
      await this.stop();
      console.log(pc.dim('HMR server stopped.'));
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}

/**
 * Run the development server with HMR enabled
 */
export async function runHMRServer(options: HMRRunnerOptions): Promise<void> {
  const runner = new HMRRunner(options);
  await runner.start();
}
