/**
 * HMR Runner - Hot Module Replacement for Development
 *
 * Manages a Node.js process with hot-hook enabled for fast module replacement.
 * Provides rich feedback with timing information and helpful error messages.
 *
 * @see https://github.com/Julien-R44/hot-hook
 */

import { type ChildProcess, spawn } from 'node:child_process';

import pc from 'picocolors';

import { error } from '../utils/output.js';
import { parseDevError, type ParsedDevError } from './error-parser.js';
import { createReloadReporter, type ReloadReporter } from './reload-reporter.js';
import { createTimingTracker, type TimingTracker } from './timing-tracker.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Delay before assuming server is ready (ms).
 * Used as fallback when no explicit ready signal is received.
 */
const STARTUP_DETECTION_DELAY_MS = 100;

/**
 * Timeout for graceful shutdown before force kill (ms).
 */
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5000;

/**
 * Timeout for process to exit during restart (ms).
 */
const RESTART_EXIT_TIMEOUT_MS = 2000;

/**
 * Placeholder duration for hot updates (ms).
 *
 * Note: hot-hook doesn't currently provide timing information in IPC messages.
 * This is a reasonable estimate since hot updates typically complete in <10ms.
 * TODO: Request timing data from hot-hook or measure via timestamps.
 */
const HOT_UPDATE_ESTIMATED_DURATION_MS = 5;

// ============================================================================
// Types
// ============================================================================

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
  /** Show detailed timing and reload information */
  readonly verbose?: boolean;
  /** Clear console on full restart */
  readonly clearOnRestart?: boolean;
}

/**
 * IPC message structure from hot-hook library.
 * All properties are optional since we validate at runtime.
 */
interface HotHookMessage {
  readonly type?: string;
  readonly file?: string;
  readonly error?: string;
  readonly boundary?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Validate that an unknown value is a valid HotHookMessage.
 *
 * Performs runtime type checking to ensure IPC messages from hot-hook
 * conform to the expected shape before processing.
 *
 * @param value - Unknown value to validate
 * @returns Type predicate indicating if value is HotHookMessage
 */
function isHotHookMessage(value: unknown): value is HotHookMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Validate each optional property has the correct type if present
  if (obj.type !== undefined && typeof obj.type !== 'string') {
    return false;
  }
  if (obj.file !== undefined && typeof obj.file !== 'string') {
    return false;
  }
  if (obj.error !== undefined && typeof obj.error !== 'string') {
    return false;
  }
  if (obj.boundary !== undefined && typeof obj.boundary !== 'string') {
    return false;
  }

  return true;
}

// ============================================================================
// HMRRunner Class
// ============================================================================

/**
 * HMR Runner manages a Node.js process with hot-hook enabled
 * for fast hot module replacement during development.
 */
export class HMRRunner {
  private child: ChildProcess | null = null;
  private isShuttingDown = false;
  private isStartingUp = false;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;

  // Integrated modules
  private readonly timing: TimingTracker;
  private readonly reporter: ReloadReporter;

  constructor(private readonly options: HMRRunnerOptions) {
    this.timing = createTimingTracker();
    this.reporter = createReloadReporter({
      verbose: options.verbose ?? false,
      clearOnRestart: options.clearOnRestart ?? true,
    });
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Start the HMR-enabled development server
   */
  async start(): Promise<void> {
    this.reporter.printHMRStatus();
    this.timing.start('startup');
    this.isStartingUp = true;

    await this.spawnProcess();
    this.setupSignalHandlers();
  }

  /**
   * Stop the HMR runner gracefully
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.timing.start('shutdown');

    if (this.child) {
      this.child.kill('SIGTERM');

      // Wait for graceful shutdown with timeout
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.child) {
            this.child.kill('SIGKILL');
          }
          resolve();
        }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);

        this.child?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    const duration = this.timing.end('shutdown');
    if (this.options.verbose) {
      console.log(pc.dim(`  Shutdown completed in ${duration}ms`));
    }

    // Print final statistics in verbose mode
    this.reporter.printStatistics();
  }

  // --------------------------------------------------------------------------
  // Private: Process Management
  // --------------------------------------------------------------------------

  /**
   * Restart the process (called when HMR fails or non-boundary file changes)
   */
  private async restart(reason: string, filePath?: string): Promise<void> {
    this.reporter.reportFullRestart(reason, filePath);
    this.timing.start('restart');

    if (this.child) {
      this.child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const exitHandler = () => resolve();
        this.child?.once('exit', exitHandler);
        // Timeout in case process doesn't exit gracefully
        setTimeout(() => {
          this.child?.removeListener('exit', exitHandler);
          resolve();
        }, RESTART_EXIT_TIMEOUT_MS);
      });
    }

    this.isStartingUp = true;
    await this.spawnProcess();
  }

  /**
   * Spawn the Node.js process with hot-hook enabled
   */
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
    // tsx provides TypeScript support, hot-hook provides HMR
    this.child = spawn('node', ['--import=tsx', '--import=hot-hook/register', this.options.entry], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      env,
      cwd: process.cwd(),
    });

    // Set up IPC message handler
    this.child.on('message', (message) => this.handleIPCMessage(message));

    // Set up process event handlers
    this.child.on('error', (err) => this.handleProcessError(err));
    this.child.on('exit', (code, signal) => this.handleProcessExit(code, signal));

    // Detect startup completion
    // The server will send a message or we detect via stdout
    this.setupStartupDetection();
  }

  /**
   * Setup detection for when the server is ready
   */
  private setupStartupDetection(): void {
    // Give the server time to start, then report ready
    // Ideally we'd listen for a specific ready message from the server
    this.startupTimer = setTimeout(() => {
      if (this.isStartingUp) {
        this.reportStartupComplete();
      }
    }, STARTUP_DETECTION_DELAY_MS);

    // Also listen for early exit (startup failure)
    this.child?.once('exit', () => {
      if (this.startupTimer) {
        clearTimeout(this.startupTimer);
        this.startupTimer = null;
      }
    });
  }

  /**
   * Report that startup is complete
   */
  private reportStartupComplete(): void {
    if (!this.isStartingUp) return;
    this.isStartingUp = false;

    const label = this.timing.isInProgress('restart') ? 'restart' : 'startup';
    const duration = this.timing.end(label);

    const url = `http://${this.options.host}:${this.options.port}`;
    this.reporter.reportStartupComplete(url, duration);
  }

  // --------------------------------------------------------------------------
  // Private: IPC Message Handling
  // --------------------------------------------------------------------------

  /**
   * Handle IPC messages from hot-hook
   */
  private handleIPCMessage(message: unknown): void {
    // Validate message shape before processing
    if (!isHotHookMessage(message)) {
      return;
    }

    switch (message.type) {
      case 'hot-hook:update':
        this.handleHotUpdate(message);
        break;

      case 'hot-hook:full-reload':
        this.handleFullReloadRequest(message);
        break;

      case 'hot-hook:error':
        this.handleHMRError(message);
        break;

      case 'velox:ready':
        // Custom message from VeloxTS server indicating ready
        this.reportStartupComplete();
        break;

      default:
        // Ignore unknown messages
        break;
    }
  }

  /**
   * Handle successful hot module update
   */
  private handleHotUpdate(msg: HotHookMessage): void {
    // Report startup complete if this is the first update after restart
    if (this.isStartingUp) {
      this.reportStartupComplete();
    }

    const file = msg.file ?? 'unknown';

    // Use estimated duration since hot-hook doesn't provide timing data
    // See HOT_UPDATE_ESTIMATED_DURATION_MS constant for details
    this.reporter.reportHotUpdate(file, HOT_UPDATE_ESTIMATED_DURATION_MS);
  }

  /**
   * Handle request for full process reload
   */
  private handleFullReloadRequest(msg: HotHookMessage): void {
    const reason = msg.file
      ? `${this.getBasename(msg.file)} changed (outside HMR boundaries)`
      : 'File changed outside HMR boundaries';

    this.restart(reason, msg.file).catch((err) => {
      this.handleRestartError(err);
    });
  }

  /**
   * Handle HMR-specific error
   */
  private handleHMRError(msg: HotHookMessage): void {
    const errorMsg = msg.error ?? 'Unknown HMR error';
    this.reporter.reportHMRFallback(errorMsg);

    const reason = 'HMR update failed';
    this.restart(reason, msg.file).catch((err) => {
      this.handleRestartError(err);
    });
  }

  // --------------------------------------------------------------------------
  // Private: Error Handling
  // --------------------------------------------------------------------------

  /**
   * Handle process spawn/runtime errors
   */
  private handleProcessError(err: Error): void {
    const parsed = parseDevError(err);

    if (parsed.type === 'port-in-use') {
      // Port in use is a fatal error
      this.reporter.reportCompilationError(err, undefined, parsed.suggestion);
      error(`Port ${this.options.port} is already in use.`);
      console.log(`  ${pc.dim(`Try: velox dev --port ${Number(this.options.port) + 1}`)}`);
      process.exit(1);
    }

    // For recoverable errors, report and attempt restart
    if (parsed.isRecoverable) {
      this.reporter.reportRuntimeError(err);
      if (!this.isShuttingDown) {
        this.restart('Runtime error', parsed.filePath).catch(() => {
          process.exit(1);
        });
      }
    } else {
      this.reportFatalError(parsed);
      process.exit(1);
    }
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }

    if (this.isShuttingDown) return;

    if (code !== 0 && code !== null) {
      // Process crashed - check if it was during startup
      if (this.isStartingUp) {
        error('Server failed to start. Check for syntax or configuration errors.');
        console.log(`  ${pc.dim('Watching for changes...')}`);
        this.isStartingUp = false;
        // Don't exit - wait for file changes to fix the error
      } else {
        // Runtime crash
        this.reporter.reportRuntimeError();
        console.log(`  ${pc.dim(`Process exited with code ${code}`)}`);
        console.log(`  ${pc.dim('Watching for changes...')}`);
      }
    } else if (signal) {
      // Process was killed by signal
      if (this.options.verbose) {
        console.log(pc.dim(`  Process killed by signal: ${signal}`));
      }
    }
  }

  /**
   * Handle restart failure
   */
  private handleRestartError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    error(`Failed to restart: ${message}`);
  }

  /**
   * Report a fatal error that cannot be recovered
   */
  private reportFatalError(parsed: ParsedDevError): void {
    this.reporter.reportCompilationError(
      parsed.originalError,
      parsed.filePath,
      parsed.suggestion
    );
  }

  // --------------------------------------------------------------------------
  // Private: Signal Handling
  // --------------------------------------------------------------------------

  /**
   * Setup process signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n${pc.yellow('⚠')} Received ${signal}, shutting down...`);
      await this.stop();
      console.log(pc.dim('Development server stopped.'));
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  // --------------------------------------------------------------------------
  // Private: Utilities
  // --------------------------------------------------------------------------

  /**
   * Get basename from file path
   */
  private getBasename(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Run the development server with HMR enabled
 */
export async function runHMRServer(options: HMRRunnerOptions): Promise<void> {
  const runner = new HMRRunner(options);
  await runner.start();
}
