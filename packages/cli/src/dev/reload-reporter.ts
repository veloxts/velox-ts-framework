/**
 * Reload Reporter - Provides feedback during development reloads
 *
 * Tracks reload events and displays formatted output with timing information.
 * Inspired by Laravel's artisan serve and Vite's dev server feedback.
 *
 * Design principles:
 * - Clear visual hierarchy (icons, colors, spacing)
 * - Progressive disclosure (essential info by default, details on demand)
 * - Status at a glance (timestamp, duration, file changed)
 * - Context-aware messages (different output for hot update vs full restart)
 *
 * @example
 * ```typescript
 * const reporter = createReloadReporter({ verbose: false, clearOnRestart: true });
 *
 * reporter.printHMRStatus();
 * reporter.reportHotUpdate('src/procedures/users.ts', 23);
 * reporter.reportFullRestart('src/config/app.ts changed');
 * reporter.reportStartupComplete('http://localhost:3030', 847);
 * ```
 */

import pc from 'picocolors';

import { formatDuration } from '../utils/output.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the reload reporter
 */
export interface ReloadReporterOptions {
  /** Show verbose timing breakdown and additional details */
  readonly verbose: boolean;
  /** Clear console on full restart (not on hot updates) */
  readonly clearOnRestart: boolean;
}

/**
 * Types of reload events for tracking and analytics
 */
export type ReloadEventType = 'hot-update' | 'full-restart' | 'error' | 'startup';

/**
 * Details about a reload event (for logging/analytics)
 */
export interface ReloadEvent {
  readonly type: ReloadEventType;
  readonly timestamp: number;
  readonly filePath?: string;
  readonly duration?: number;
  readonly error?: Error;
}

/**
 * HMR boundary configuration for display
 */
export interface HMRBoundary {
  readonly label: string;
  readonly pattern: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default HMR boundaries shown in status banner
 */
const DEFAULT_HMR_BOUNDARIES: readonly HMRBoundary[] = [
  { label: 'Procedures', pattern: 'src/procedures/**/*.ts' },
  { label: 'Schemas', pattern: 'src/schemas/**/*.ts' },
  { label: 'Handlers', pattern: 'src/handlers/**/*.ts' },
];

/**
 * Maximum file path length before truncation
 */
const MAX_FILE_PATH_LENGTH = 50;

// ============================================================================
// ReloadReporter Class
// ============================================================================

/**
 * Formats and displays reload feedback during development.
 *
 * This class is responsible for all HMR-related console output.
 * It maintains consistent formatting and provides both terse and verbose modes.
 */
export class ReloadReporter {
  /** Track reload history for statistics (verbose mode) */
  private readonly reloadHistory: ReloadEvent[] = [];

  /** Count of hot updates since last full restart */
  private hotUpdateCount = 0;

  /** Count of full restarts since server start */
  private fullRestartCount = 0;

  /** Timestamp of last reload (any type) */
  private lastReloadTime: number | null = null;

  constructor(private readonly options: ReloadReporterOptions) {}

  // --------------------------------------------------------------------------
  // Public API: Reporting Methods
  // --------------------------------------------------------------------------

  /**
   * Report a successful hot module update.
   *
   * Called when hot-hook successfully swaps a module without full restart.
   *
   * @param filePath - Path to the file that was hot-updated
   * @param duration - Time taken for the hot update in milliseconds
   */
  reportHotUpdate(filePath: string, duration: number): void {
    this.lastReloadTime = Date.now();
    this.hotUpdateCount++;

    this.recordEvent({
      type: 'hot-update',
      timestamp: this.lastReloadTime,
      filePath,
      duration,
    });

    const timestamp = this.formatTimestamp();
    const file = this.formatFilePath(filePath);
    const time = pc.dim(`(${formatDuration(duration)})`);

    console.log(`${timestamp}  ${pc.green('⚡')} ${pc.green('Hot updated')}  ${file}  ${time}`);

    if (this.options.verbose) {
      this.printVerboseHotUpdate(duration);
    }
  }

  /**
   * Report that a full process restart is starting.
   *
   * Called when a file outside HMR boundaries changes, requiring full restart.
   *
   * @param reason - Human-readable reason for the restart
   * @param filePath - Optional path to the file that triggered restart
   */
  reportFullRestart(reason: string, filePath?: string): void {
    if (this.options.clearOnRestart) {
      console.clear();
    }

    this.fullRestartCount++;

    // Reset hot update count on full restart
    this.hotUpdateCount = 0;

    const timestamp = this.formatTimestamp();
    const reasonText = pc.dim(reason);

    console.log(`${timestamp}  ${pc.yellow('🔄')} ${pc.yellow('Restarting')}  ${reasonText}`);

    if (this.options.verbose && filePath) {
      console.log(pc.dim(`             └─ Triggered by: ${filePath}`));
    }
  }

  /**
   * Report successful startup after restart.
   *
   * Called when the server is ready to accept connections after a restart.
   *
   * @param url - Server URL (e.g., "http://localhost:3030")
   * @param duration - Time taken for startup in milliseconds
   */
  reportStartupComplete(url: string, duration: number): void {
    this.lastReloadTime = Date.now();

    this.recordEvent({
      type: 'startup',
      timestamp: this.lastReloadTime,
      duration,
    });

    const timestamp = this.formatTimestamp();
    const urlFormatted = pc.cyan(url);
    const time = pc.dim(`(${formatDuration(duration)})`);

    console.log(
      `${timestamp}  ${pc.green('✓')} ${pc.green('Server ready')}  ${urlFormatted}  ${time}`
    );

    if (this.options.verbose) {
      this.printVerboseStartup(duration);
    }
  }

  /**
   * Report a compilation/syntax error.
   *
   * Called when TypeScript compilation fails or there's a syntax error.
   * The server continues watching for changes to fix the error.
   *
   * @param error - The error object
   * @param filePath - Optional path to the file that caused the error
   * @param suggestion - Optional suggestion for fixing the error
   */
  reportCompilationError(error: Error, filePath?: string, suggestion?: string): void {
    this.recordEvent({
      type: 'error',
      timestamp: Date.now(),
      filePath,
      error,
    });

    const timestamp = this.formatTimestamp();
    const file = filePath ? this.formatFilePath(filePath) : pc.dim('unknown file');

    console.log('');
    console.log(`${timestamp}  ${pc.red('✗')} ${pc.red('Compilation failed')}  ${file}`);
    console.log('');

    // Format error message
    this.printFormattedError(error);

    // Print suggestion if available
    if (suggestion) {
      console.log('');
      console.log(`  ${pc.yellow('Suggestion:')} ${suggestion}`);
    }

    console.log('');
    console.log(pc.dim('  Waiting for changes...'));
    console.log('');
  }

  /**
   * Report a runtime error (after successful compilation).
   *
   * Called when an error occurs during execution, not compilation.
   * HMR continues watching for changes.
   *
   * @param error - Optional error object for verbose mode
   */
  reportRuntimeError(error?: Error): void {
    this.recordEvent({
      type: 'error',
      timestamp: Date.now(),
      error,
    });

    const timestamp = this.formatTimestamp();

    console.log(`${timestamp}  ${pc.yellow('⚠')} ${pc.yellow('Runtime error occurred')}`);
    console.log('');
    console.log(pc.dim('  Check your application logs for details.'));
    console.log(pc.dim('  HMR continues watching for changes.'));

    if (this.options.verbose && error) {
      console.log('');
      console.log(pc.dim(`  Error: ${error.message}`));
    }

    console.log('');
  }

  /**
   * Report that HMR failed and falling back to full restart.
   *
   * @param reason - Why HMR failed
   */
  reportHMRFallback(reason: string): void {
    const timestamp = this.formatTimestamp();
    console.log(`${timestamp}  ${pc.yellow('⚠')} ${pc.yellow('HMR failed:')} ${pc.dim(reason)}`);
    console.log(pc.dim('             └─ Falling back to full restart...'));
  }

  // --------------------------------------------------------------------------
  // Public API: Status Banners
  // --------------------------------------------------------------------------

  /**
   * Print the initial HMR status banner.
   *
   * Shows that HMR is enabled and which file patterns are hot-reloadable.
   *
   * @param boundaries - Optional custom boundaries (defaults to standard patterns)
   */
  printHMRStatus(boundaries?: readonly HMRBoundary[]): void {
    const boundariesToShow = boundaries ?? DEFAULT_HMR_BOUNDARIES;

    console.log('');
    console.log(`  ${pc.green('⚡')} ${pc.green('HMR enabled')}`);
    console.log(pc.dim('  Hot module replacement active for:'));

    for (const boundary of boundariesToShow) {
      console.log(pc.dim(`    • ${boundary.label} (${boundary.pattern})`));
    }

    console.log('');
    console.log(pc.dim('  Config/database changes trigger full restart.'));
    console.log('');
  }

  /**
   * Print debug mode status banner.
   *
   * Shows when debug logging and request tracing are enabled via --debug flag.
   */
  printDebugStatus(): void {
    console.log(`  ${pc.magenta('🔍')} ${pc.magenta('Debug mode enabled')}`);
    console.log(pc.dim('  Request/response logging active'));
    console.log('');
  }

  /**
   * Print legacy mode warning.
   *
   * Shows when user explicitly disabled HMR with --no-hmr flag.
   */
  printLegacyModeWarning(): void {
    console.log('');
    console.log(`  ${pc.yellow('⚠')} ${pc.yellow('Legacy watch mode')}`);
    console.log(pc.dim('  HMR disabled - every change triggers full restart.'));
    console.log(pc.dim(`  Remove ${pc.cyan('--no-hmr')} flag for faster reloads.`));
    console.log('');
  }

  /**
   * Print a summary of reload statistics (verbose mode only).
   *
   * Shows total hot updates, restarts, and session duration.
   */
  printStatistics(): void {
    if (!this.options.verbose) {
      return;
    }

    console.log('');
    console.log(pc.dim('  ─── Session Statistics ───'));
    console.log(pc.dim(`  Hot updates: ${this.hotUpdateCount}`));
    console.log(pc.dim(`  Full restarts: ${this.fullRestartCount}`));
    console.log(pc.dim(`  Total events: ${this.reloadHistory.length}`));
    console.log('');
  }

  // --------------------------------------------------------------------------
  // Public API: Accessors
  // --------------------------------------------------------------------------

  /**
   * Get the number of hot updates since last full restart.
   */
  getHotUpdateCount(): number {
    return this.hotUpdateCount;
  }

  /**
   * Get the number of full restarts since server start.
   */
  getFullRestartCount(): number {
    return this.fullRestartCount;
  }

  /**
   * Get the reload history (for debugging/analytics).
   */
  getReloadHistory(): readonly ReloadEvent[] {
    return this.reloadHistory;
  }

  /**
   * Clear the reload history.
   */
  clearHistory(): void {
    this.reloadHistory.length = 0;
  }

  // --------------------------------------------------------------------------
  // Private: Formatting Helpers
  // --------------------------------------------------------------------------

  /**
   * Format current time as HH:MM:SS
   */
  private formatTimestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return pc.dim(`${hours}:${minutes}:${seconds}`);
  }

  /**
   * Format file path, truncating if too long.
   */
  private formatFilePath(filePath: string): string {
    // Remove leading ./ if present
    let normalized = filePath.startsWith('./') ? filePath.slice(2) : filePath;

    // Truncate if too long
    if (normalized.length > MAX_FILE_PATH_LENGTH) {
      normalized = `...${normalized.slice(-(MAX_FILE_PATH_LENGTH - 3))}`;
    }

    return pc.cyan(normalized);
  }

  /**
   * Print verbose hot update information.
   */
  private printVerboseHotUpdate(duration: number): void {
    console.log(pc.dim('             ├─ Module swap completed'));
    console.log(pc.dim(`             └─ Total: ${formatDuration(duration)}`));
  }

  /**
   * Print verbose startup information.
   */
  private printVerboseStartup(duration: number): void {
    // For MVP, just show total time
    // Future enhancement: Break down into phases
    console.log(pc.dim(`             └─ Startup: ${formatDuration(duration)}`));
  }

  /**
   * Print formatted error with syntax highlighting attempt.
   */
  private printFormattedError(error: Error): void {
    const lines = error.message.split('\n');

    for (const line of lines) {
      // Indent error lines
      console.log(`  ${pc.red(line)}`);
    }

    // If there's a stack trace and we're in verbose mode, show first few lines
    if (this.options.verbose && error.stack) {
      const stackLines = error.stack.split('\n').slice(1, 4);
      for (const line of stackLines) {
        console.log(pc.dim(`  ${line.trim()}`));
      }
    }
  }

  /**
   * Record an event for history/analytics.
   */
  private recordEvent(event: ReloadEvent): void {
    this.reloadHistory.push(event);

    // Keep history bounded to prevent memory growth
    if (this.reloadHistory.length > 100) {
      this.reloadHistory.shift();
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ReloadReporter instance.
 *
 * @param options - Configuration options
 * @returns New ReloadReporter instance
 */
export function createReloadReporter(options: ReloadReporterOptions): ReloadReporter {
  return new ReloadReporter(options);
}
