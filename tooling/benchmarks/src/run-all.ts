#!/usr/bin/env node

/**
 * Run All Benchmarks
 *
 * Executes all benchmark suites and generates a summary report.
 */

import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { runLatencyBenchmark } from './benchmarks/latency.js';
import { runMemoryBenchmark } from './benchmarks/memory.js';
import { runStartupBenchmark } from './benchmarks/startup.js';
import { runThroughputBenchmark } from './benchmarks/throughput.js';
import type { BenchmarkResults } from './types.js';
import {
  createConfig,
  printHeader,
  printSummary,
  spawnServer,
  stopServer,
  waitForServer,
} from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYGROUND_DIR = path.resolve(__dirname, '../../../apps/playground');
const RESULTS_DIR = path.resolve(__dirname, '..');
const BENCHMARK_PORT = 3030;

/**
 * Check for processes using the benchmark port and display them to the user
 */
function checkForOrphanedProcesses(): void {
  try {
    const output = execSync(`lsof -i :${BENCHMARK_PORT} -t 2>/dev/null`, { encoding: 'utf-8' });
    const pids = output.trim().split('\n').filter(Boolean);

    if (pids.length > 0) {
      console.log(
        `\n\x1b[33m⚠️  Warning: Found processes still using port ${BENCHMARK_PORT}:\x1b[0m`
      );
      console.log('\x1b[33m   To clean up, run:\x1b[0m');
      for (const pid of pids) {
        console.log(`\x1b[36m   kill -9 ${pid}\x1b[0m`);
      }
      console.log('');
    }
  } catch {
    // No processes found on port, which is fine
  }
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers(): void {
  const handleExit = (signal: string) => {
    console.log(`\n\n\x1b[31m  Benchmark interrupted (${signal})\x1b[0m`);
    checkForOrphanedProcesses();
    process.exit(130); // Standard exit code for SIGINT
  };

  process.on('SIGINT', () => handleExit('SIGINT'));
  process.on('SIGTERM', () => handleExit('SIGTERM'));
}

/**
 * Writes benchmark results to JSON file
 */
async function writeResults(results: BenchmarkResults): Promise<void> {
  const filename = `benchmark-results-${new Date().toISOString().split('T')[0]}.json`;
  const filepath = path.join(RESULTS_DIR, filename);

  await writeFile(filepath, JSON.stringify(results, null, 2));
  console.log(`\n  Results written to: ${filepath}`);
}

/**
 * Main benchmark runner
 */
async function main(): Promise<void> {
  // Setup signal handlers to show orphaned processes on interrupt
  setupSignalHandlers();

  const startTime = Date.now();

  printHeader('VeloxTS Performance Benchmarks');

  console.log('  Node Version:', process.version);
  console.log('  Platform:', process.platform);
  console.log('  Date:', new Date().toISOString());

  const config = createConfig();
  const results: BenchmarkResults = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
  };

  let passed = 0;
  let failed = 0;
  const skipped = 0;

  // =========================================================================
  // Startup Benchmark (runs first, needs no server running)
  // =========================================================================
  console.log('\n');

  try {
    const serverRunning = await waitForServer(config.targetUrl, 1000);
    if (serverRunning) {
      console.log('  Skipping startup benchmark (server already running)');
    } else {
      const startupResult = await runStartupBenchmark(config);
      results.startup = startupResult.average;
      if (startupResult.meetsTarget) {
        passed++;
      } else {
        failed++;
      }
    }
  } catch (err) {
    console.error('  Startup benchmark failed:', err);
    failed++;
  }

  // =========================================================================
  // Start server for remaining benchmarks
  // =========================================================================
  let serverProcess = null;
  const serverAlreadyRunning = await waitForServer(config.targetUrl, 1000);

  if (!serverAlreadyRunning) {
    printHeader('Starting Benchmark Server');

    serverProcess = spawnServer(PLAYGROUND_DIR, 'node', ['dist/index.js'], {
      USE_MOCK_DB: 'true',
      LOG_LEVEL: 'silent', // Disable logging to prevent memory accumulation during benchmarks
    });

    const serverReady = await waitForServer(config.targetUrl, 30000);
    if (!serverReady) {
      console.error('  Failed to start server');
      process.exit(1);
    }

    console.log('  Server ready');
    await sleep(2000); // Let server stabilize
  }

  try {
    // =========================================================================
    // Throughput Benchmark
    // =========================================================================
    try {
      const throughputResult = await runThroughputBenchmark(config);
      results.throughput = throughputResult;
      if (throughputResult.meetsTarget) {
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error('  Throughput benchmark failed:', err);
      failed++;
    }

    // =========================================================================
    // Latency Benchmark
    // =========================================================================
    try {
      const latencyConfig = createConfig({ duration: 5 });
      const latencyResult = await runLatencyBenchmark(latencyConfig);
      // Latency is already included in throughput, but we track p50 target separately
      if (latencyResult.meetsTarget) {
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error('  Latency benchmark failed:', err);
      failed++;
    }

    // =========================================================================
    // Memory Benchmark
    // =========================================================================
    try {
      const memoryResult = await runMemoryBenchmark(config, serverProcess);
      results.memory = memoryResult.baseline;
      if (memoryResult.meetsTarget) {
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error('  Memory benchmark failed:', err);
      failed++;
    }
  } finally {
    // Stop server if we started it
    if (serverProcess) {
      printHeader('Stopping Benchmark Server');
      await stopServer(serverProcess);
      console.log('  Server stopped');
    }
  }

  // =========================================================================
  // Summary
  // =========================================================================
  const duration = (Date.now() - startTime) / 1000;

  printSummary(passed, failed, skipped);

  console.log(`  Total time: ${duration.toFixed(1)} seconds\n`);

  // Write results to file
  await writeResults(results);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Benchmark suite failed:', err);
  process.exit(1);
});
