/**
 * Benchmark Utilities
 *
 * Common utilities for benchmark execution and reporting.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

import type { BenchmarkConfig, LatencyPercentiles, MemoryResult } from './types.js';

/**
 * Development JWT secrets for benchmarking
 * These are only used for performance testing, never in production
 */
export const BENCHMARK_ENV = {
  // 64+ character secrets for JWT validation
  JWT_SECRET: 'benchmark-jwt-secret-for-performance-testing-only-64-characters-minimum-required',
  JWT_REFRESH_SECRET: 'benchmark-refresh-secret-for-performance-testing-only-64-chars-minimum',
  NODE_ENV: 'development',
} as const;

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
} as const;

/**
 * Formats a number with commas for readability
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Formats bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Formats milliseconds to human readable format
 */
export function formatMs(ms: number): string {
  if (ms === undefined || ms === null || Number.isNaN(ms)) {
    return 'N/A';
  }
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)} us`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(2)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Prints a section header
 */
export function printHeader(title: string): void {
  const divider = '='.repeat(60);
  console.log(`\n${colors.cyan}${divider}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${divider}${colors.reset}\n`);
}

/**
 * Prints a metric with pass/fail indicator
 */
export function printMetric(
  label: string,
  value: string,
  target: string,
  meetsTarget: boolean
): void {
  const status = meetsTarget
    ? `${colors.green}PASS${colors.reset}`
    : `${colors.red}FAIL${colors.reset}`;
  const valueColor = meetsTarget ? colors.green : colors.red;

  console.log(
    `  ${label.padEnd(25)} ${valueColor}${value.padEnd(15)}${colors.reset} ${colors.dim}(target: ${target})${colors.reset} [${status}]`
  );
}

/**
 * Prints a simple info line
 */
export function printInfo(label: string, value: string): void {
  console.log(`  ${label.padEnd(25)} ${colors.blue}${value}${colors.reset}`);
}

/**
 * Prints latency percentiles
 */
export function printLatency(latency: LatencyPercentiles): void {
  console.log(`\n  ${colors.bold}Latency Percentiles:${colors.reset}`);
  console.log(`    p50:    ${formatMs(latency.p50)}`);
  console.log(`    p75:    ${formatMs(latency.p75)}`);
  console.log(`    p90:    ${formatMs(latency.p90)}`);
  console.log(`    p95:    ${formatMs(latency.p95)}`);
  console.log(`    p99:    ${formatMs(latency.p99)}`);
  console.log(`    max:    ${formatMs(latency.max)}`);
  console.log(`    mean:   ${formatMs(latency.mean)}`);
  console.log(`    stddev: ${formatMs(latency.stddev)}`);
}

/**
 * Prints memory usage
 */
export function printMemory(memory: MemoryResult): void {
  console.log(`\n  ${colors.bold}Memory Breakdown:${colors.reset}`);
  console.log(`    Heap Used:     ${memory.heapUsed.toFixed(2)} MB`);
  console.log(`    Heap Total:    ${memory.heapTotal.toFixed(2)} MB`);
  console.log(`    RSS:           ${memory.rss.toFixed(2)} MB`);
  console.log(`    External:      ${memory.external.toFixed(2)} MB`);
  console.log(`    Array Buffers: ${memory.arrayBuffers.toFixed(2)} MB`);
}

/**
 * Gets current memory usage in a structured format
 */
export function getMemoryUsage(): MemoryResult {
  const usage = process.memoryUsage();
  const toMB = (bytes: number): number => bytes / 1024 / 1024;

  return {
    heapUsed: toMB(usage.heapUsed),
    heapTotal: toMB(usage.heapTotal),
    external: toMB(usage.external),
    arrayBuffers: toMB(usage.arrayBuffers),
    rss: toMB(usage.rss),
    meetsTarget: false, // Set by caller
  };
}

/**
 * Waits for a server to be ready by polling the health endpoint
 */
export async function waitForServer(url: string, timeoutMs: number = 30000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet, continue polling
    }
    await sleep(100);
  }

  return false;
}

/**
 * Spawns a server process for benchmarking
 */
export function spawnServer(
  cwd: string,
  command: string,
  args: string[],
  env: Record<string, string> = {}
): ChildProcess {
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...BENCHMARK_ENV, ...env },
  });

  // Log stderr for debugging
  child.stderr?.on('data', (data: Buffer) => {
    const message = data.toString().trim();
    if (message && !message.includes('ExperimentalWarning')) {
      console.error(`${colors.dim}[server stderr] ${message}${colors.reset}`);
    }
  });

  return child;
}

/**
 * Gracefully stops a server process
 */
export async function stopServer(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.killed) {
      resolve();
      return;
    }

    child.on('exit', () => resolve());
    child.kill('SIGTERM');

    // Force kill after timeout
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 5000);
  });
}

/**
 * Creates the benchmark configuration from environment or defaults
 */
export function createConfig(overrides: Partial<BenchmarkConfig> = {}): BenchmarkConfig {
  const defaults: BenchmarkConfig = {
    targetUrl: 'http://127.0.0.1:3030',
    port: 3030,
    duration: 10,
    connections: 100,
    pipelining: 10,
    warmupDuration: 3,
    startupIterations: 5,
  };

  return { ...defaults, ...overrides };
}

/**
 * Prints benchmark summary
 */
export function printSummary(passed: number, failed: number, skipped: number): void {
  const total = passed + failed + skipped;
  const divider = '='.repeat(60);

  console.log(`\n${colors.cyan}${divider}${colors.reset}`);
  console.log(`${colors.bold}  BENCHMARK SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${divider}${colors.reset}\n`);

  console.log(`  ${colors.green}Passed:${colors.reset}  ${passed}/${total}`);
  console.log(`  ${colors.red}Failed:${colors.reset}  ${failed}/${total}`);
  if (skipped > 0) {
    console.log(`  ${colors.yellow}Skipped:${colors.reset} ${skipped}/${total}`);
  }

  console.log('');

  if (failed === 0) {
    console.log(`  ${colors.green}${colors.bold}All benchmarks passed!${colors.reset}`);
  } else {
    console.log(
      `  ${colors.red}${colors.bold}Some benchmarks failed. Review results above.${colors.reset}`
    );
  }

  console.log('');
}
