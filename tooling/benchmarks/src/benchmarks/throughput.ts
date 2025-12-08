/**
 * Throughput Benchmark
 *
 * Measures requests per second using autocannon.
 * Target: > 20k req/s
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

import autocannon from 'autocannon';

import {
  TARGET_METRICS,
  type BenchmarkConfig,
  type ThroughputResult,
} from '../types.js';
import {
  createConfig,
  printHeader,
  printMetric,
  printInfo,
  printLatency,
  formatNumber,
  spawnServer,
  stopServer,
  waitForServer,
} from '../utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYGROUND_DIR = path.resolve(__dirname, '../../../../apps/playground');

/**
 * Runs the throughput benchmark
 */
async function runThroughputBenchmark(
  config: BenchmarkConfig
): Promise<ThroughputResult> {
  printHeader('Throughput Benchmark');

  printInfo('Target URL', `${config.targetUrl}/api/health`);
  printInfo('Duration', `${config.duration} seconds`);
  printInfo('Connections', `${config.connections}`);
  printInfo('Pipelining', `${config.pipelining}`);

  // Run warmup
  console.log(`\n  Running warmup (${config.warmupDuration}s)...`);
  await autocannon({
    url: `${config.targetUrl}/api/health`,
    connections: config.connections,
    pipelining: config.pipelining,
    duration: config.warmupDuration,
  });

  // Run actual benchmark
  console.log(`\n  Running benchmark (${config.duration}s)...`);

  const result = await autocannon({
    url: `${config.targetUrl}/api/health`,
    connections: config.connections,
    pipelining: config.pipelining,
    duration: config.duration,
  });

  const throughput: ThroughputResult = {
    requestsPerSecond: result.requests.average,
    totalRequests: result.requests.total,
    duration: config.duration,
    connections: config.connections,
    errors: result.errors,
    errorRate: (result.errors / result.requests.total) * 100,
    latency: {
      p50: result.latency.p50,
      p75: result.latency.p75,
      p90: result.latency.p90,
      p95: result.latency.p95,
      p99: result.latency.p99,
      max: result.latency.max,
      min: result.latency.min,
      mean: result.latency.mean,
      stddev: result.latency.stddev,
    },
    meetsTarget: result.requests.average >= TARGET_METRICS.throughput,
  };

  // Print results
  console.log('\n  Results:');
  printMetric(
    'Requests/sec',
    formatNumber(throughput.requestsPerSecond),
    `> ${formatNumber(TARGET_METRICS.throughput)}`,
    throughput.meetsTarget
  );
  printMetric(
    'Latency p50',
    `${throughput.latency.p50.toFixed(2)} ms`,
    `< ${TARGET_METRICS.latencyP50} ms`,
    throughput.latency.p50 < TARGET_METRICS.latencyP50
  );
  printInfo('Total Requests', formatNumber(throughput.totalRequests));
  printInfo('Errors', formatNumber(throughput.errors));
  printInfo('Error Rate', `${throughput.errorRate.toFixed(4)}%`);

  printLatency(throughput.latency);

  return throughput;
}

/**
 * Main entry point - can be run standalone or imported
 */
async function main(): Promise<ThroughputResult | null> {
  const config = createConfig();

  // Check if server is already running
  const serverAlreadyRunning = await waitForServer(config.targetUrl, 2000);

  let serverProcess = null;

  if (!serverAlreadyRunning) {
    console.log('\n  Starting playground server...');

    serverProcess = spawnServer(
      PLAYGROUND_DIR,
      'node',
      ['dist/index.js'],
      { USE_MOCK_DB: 'true' }
    );

    const serverReady = await waitForServer(config.targetUrl, 30000);
    if (!serverReady) {
      console.error('  Failed to start server');
      await stopServer(serverProcess);
      return null;
    }

    console.log('  Server ready');
    await sleep(1000); // Let server stabilize
  } else {
    console.log('  Using existing server');
  }

  try {
    const result = await runThroughputBenchmark(config);
    return result;
  } finally {
    if (serverProcess) {
      console.log('\n  Stopping server...');
      await stopServer(serverProcess);
    }
  }
}

// Run if executed directly
const isMain = process.argv[1]?.includes('throughput');
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

export { runThroughputBenchmark, main as runThroughputBenchmarkStandalone };
