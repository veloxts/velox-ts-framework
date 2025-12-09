/**
 * Terminal output utilities
 *
 * Provides beautiful, Laravel-inspired terminal output formatting
 */

import pc from 'picocolors';

/**
 * Print a beautiful VeloxTS banner
 */
export function printBanner(version: string): void {
  const divider = '═'.repeat(50);
  console.log(`\n${pc.cyan(divider)}`);
  console.log(pc.cyan(`  VELOX ${pc.bold(`v${version}`)}`));
  console.log(pc.cyan(divider));
}

/**
 * Print server listening information
 */
export function printServerInfo(url: string): void {
  console.log('');
  console.log(`  ${pc.green('➜')}  Local:   ${pc.cyan(url)}`);
  console.log('');
}

/**
 * Print a success message
 */
export function success(message: string): void {
  console.log(`${pc.green('✓')} ${message}`);
}

/**
 * Print an error message
 */
export function error(message: string): void {
  console.error(`${pc.red('✗')} ${pc.red(message)}`);
}

/**
 * Print a warning message
 */
export function warning(message: string): void {
  console.warn(`${pc.yellow('⚠')} ${pc.yellow(message)}`);
}

/**
 * Print an info message
 */
export function info(message: string): void {
  console.log(`${pc.blue('ℹ')} ${message}`);
}

/**
 * Print a step in a process
 */
export function step(message: string): void {
  console.log(`  ${pc.dim('→')} ${message}`);
}

/**
 * Print instructions for user
 */
export function instruction(message: string): void {
  console.log(`\n  ${pc.dim(message)}\n`);
}

/**
 * Format a file path for display
 */
export function formatPath(path: string): string {
  return pc.cyan(path);
}

/**
 * Format a command for display
 */
export function formatCommand(command: string): string {
  return pc.cyan(command);
}

/**
 * Format a URL for display
 */
export function formatUrl(url: string): string {
  return pc.cyan(url);
}

/**
 * Format duration in milliseconds for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print restart timing information
 */
export function restartTiming(ms: number): void {
  console.log(`${pc.green('✓')} Restarted in ${pc.cyan(formatDuration(ms))}`);
}

/**
 * Print startup timing information
 */
export function startupTiming(ms: number): void {
  console.log(`${pc.green('✓')} Server ready in ${pc.cyan(formatDuration(ms))}`);
}
