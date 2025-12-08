/**
 * Startup Time Benchmark
 *
 * Measures server cold start time.
 * Target: < 1 second
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import {
  TARGET_METRICS,
  type BenchmarkConfig,
  type StartupResult,
} from '../types.js';
import {
  createConfig,
  printHeader,
  printMetric,
  printInfo,
  formatMs,
  spawnServer,
  stopServer,
  waitForServer,
} from '../utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYGROUND_DIR = path.resolve(__dirname, '../../../../apps/playground');

/**
 * Result structure for startup benchmark
 */
interface StartupBenchmarkResult {
  iterations: StartupResult[];
  average: StartupResult;
  fastest: StartupResult;
  slowest: StartupResult;
  meetsTarget: boolean;
}

/**
 * Measures a single startup iteration
 */
async function measureStartup(
  config: BenchmarkConfig
): Promise<StartupResult> {
  const startTime = performance.now();

  // Spawn server
  const serverProcess = spawnServer(
    PLAYGROUND_DIR,
    'node',
    ['dist/index.js'],
    { USE_MOCK_DB: 'true' }
  );

  // Wait for server to be ready
  const ready = await waitForServer(config.targetUrl, 30000);

  const startupTimeMs = performance.now() - startTime;

  if (!ready) {
    await stopServer(serverProcess);
    throw new Error('Server failed to start within timeout');
  }

  // Measure time to first response
  const firstResponseStart = performance.now();
  await fetch(`${config.targetUrl}/api/health`);
  const timeToFirstResponse = performance.now() - firstResponseStart;

  // Stop server
  await stopServer(serverProcess);

  return {
    startupTimeMs,
    timeToFirstResponse,
    meetsTarget: startupTimeMs < TARGET_METRICS.startupTime,
  };
}

/**
 * Calculates statistics from multiple iterations
 */
function calculateStats(iterations: StartupResult[]): StartupBenchmarkResult {
  const startupTimes = iterations.map((i) => i.startupTimeMs);
  const responseTimes = iterations.map((i) => i.timeToFirstResponse);

  const avgStartup = startupTimes.reduce((a, b) => a + b, 0) / startupTimes.length;
  const avgResponse = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

  const minIndex = startupTimes.indexOf(Math.min(...startupTimes));
  const maxIndex = startupTimes.indexOf(Math.max(...startupTimes));

  const average: StartupResult = {
    startupTimeMs: avgStartup,
    timeToFirstResponse: avgResponse,
    meetsTarget: avgStartup < TARGET_METRICS.startupTime,
  };

  return {
    iterations,
    average,
    fastest: iterations[minIndex],
    slowest: iterations[maxIndex],
    meetsTarget: average.meetsTarget,
  };
}

/**
 * Runs the startup benchmark
 */
async function runStartupBenchmark(
  config: BenchmarkConfig
): Promise<StartupBenchmarkResult> {
  printHeader('Startup Time Benchmark');

  printInfo('Target', `< ${TARGET_METRICS.startupTime} ms`);
  printInfo('Iterations', `${config.startupIterations}`);
  printInfo('Working Directory', PLAYGROUND_DIR);

  console.log('\n  Running iterations...\n');

  const iterations: StartupResult[] = [];

  for (let i = 0; i < config.startupIterations; i++) {
    console.log(`  Iteration ${i + 1}/${config.startupIterations}...`);

    const result = await measureStartup(config);
    iterations.push(result);

    console.log(`    Startup: ${formatMs(result.startupTimeMs)}, First Response: ${formatMs(result.timeToFirstResponse)}`);

    // Small delay between iterations to let OS clean up
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const stats = calculateStats(iterations);

  // Print results
  console.log('\n  Summary:');
  printMetric(
    'Average Startup Time',
    formatMs(stats.average.startupTimeMs),
    `< ${TARGET_METRICS.startupTime} ms`,
    stats.meetsTarget
  );
  printMetric(
    'Fastest Startup',
    formatMs(stats.fastest.startupTimeMs),
    `< ${TARGET_METRICS.startupTime} ms`,
    stats.fastest.meetsTarget
  );
  printMetric(
    'Slowest Startup',
    formatMs(stats.slowest.startupTimeMs),
    `< ${TARGET_METRICS.startupTime} ms`,
    stats.slowest.meetsTarget
  );
  printInfo('Avg Time to First Response', formatMs(stats.average.timeToFirstResponse));

  // Calculate variance
  const variance =
    iterations.reduce(
      (sum, i) => sum + Math.pow(i.startupTimeMs - stats.average.startupTimeMs, 2),
      0
    ) / iterations.length;
  const stddev = Math.sqrt(variance);
  printInfo('Std Deviation', formatMs(stddev));

  return stats;
}

/**
 * Main entry point - can be run standalone or imported
 */
async function main(): Promise<StartupBenchmarkResult | null> {
  const config = createConfig({
    startupIterations: 5,
  });

  // Make sure no server is running on the target port
  const serverRunning = await waitForServer(config.targetUrl, 1000);
  if (serverRunning) {
    console.error('\n  Error: Server is already running on target port.');
    console.error('  Please stop the server before running startup benchmarks.');
    return null;
  }

  try {
    const result = await runStartupBenchmark(config);
    return result;
  } catch (err) {
    console.error('Benchmark failed:', err);
    return null;
  }
}

// Run if executed directly
const isMain = process.argv[1]?.includes('startup');
if (isMain) {
  main()
    .then((result) => {
      if (result) {
        process.exit(result.meetsTarget ? 0 : 1);
      } else {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Benchmark failed:', err);
      process.exit(1);
    });
}

export { runStartupBenchmark, main as runStartupBenchmarkStandalone };
export type { StartupBenchmarkResult };
