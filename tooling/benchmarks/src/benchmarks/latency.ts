/**
 * Latency Benchmark
 *
 * Measures request latency with focus on percentiles.
 * Target: p50 < 5ms
 */

import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import autocannon from 'autocannon';

import { type BenchmarkConfig, type LatencyPercentiles, TARGET_METRICS } from '../types.js';
import {
  createConfig,
  formatMs,
  printHeader,
  printInfo,
  printMetric,
  spawnServer,
  stopServer,
  waitForServer,
} from '../utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYGROUND_DIR = path.resolve(__dirname, '../../../../apps/playground');

/**
 * Result structure for latency benchmark
 */
interface LatencyResult {
  latency: LatencyPercentiles;
  endpoints: Map<string, LatencyPercentiles>;
  meetsTarget: boolean;
}

/**
 * Safely extracts a numeric value, returning undefined if invalid
 */
function safeNumber(value: number | undefined | null): number | undefined {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

/**
 * Interpolates a missing percentile from surrounding values
 * For example, p95 can be estimated from p90 and p99
 */
function interpolatePercentile(
  lower: number | undefined,
  upper: number | undefined,
  lowerPct: number,
  upperPct: number,
  targetPct: number
): number | undefined {
  if (lower === undefined || upper === undefined) {
    return lower ?? upper; // Return whichever is available
  }
  // Linear interpolation
  const ratio = (targetPct - lowerPct) / (upperPct - lowerPct);
  return lower + (upper - lower) * ratio;
}

/**
 * Runs latency benchmark for a specific endpoint
 */
async function benchmarkEndpoint(
  url: string,
  name: string,
  connections: number,
  duration: number
): Promise<LatencyPercentiles> {
  console.log(`\n  Benchmarking ${name}...`);

  const result = await autocannon({
    url,
    connections,
    pipelining: 1, // No pipelining for accurate latency measurement
    duration,
  });

  // Extract values safely, handling undefined/NaN
  const p50 = safeNumber(result.latency.p50);
  const p75 = safeNumber(result.latency.p75);
  const p90 = safeNumber(result.latency.p90);
  let p95 = safeNumber(result.latency.p95);
  const p99 = safeNumber(result.latency.p99);

  // Interpolate p95 if missing but p90 and p99 are available
  if (p95 === undefined && (p90 !== undefined || p99 !== undefined)) {
    p95 = interpolatePercentile(p90, p99, 90, 99, 95);
  }

  return {
    p50: p50 ?? 0,
    p75: p75 ?? 0,
    p90: p90 ?? 0,
    p95: p95 ?? 0,
    p99: p99 ?? 0,
    max: safeNumber(result.latency.max) ?? 0,
    min: safeNumber(result.latency.min) ?? 0,
    mean: safeNumber(result.latency.mean) ?? 0,
    stddev: safeNumber(result.latency.stddev) ?? 0,
  };
}

/**
 * Prints latency comparison table
 */
function printLatencyTable(endpoints: Map<string, LatencyPercentiles>): void {
  console.log('\n  Latency by Endpoint:');
  console.log(`  ${'-'.repeat(80)}`);
  console.log(
    `  ${'Endpoint'.padEnd(25)} ${'p50'.padStart(10)} ${'p95'.padStart(10)} ${'p99'.padStart(10)} ${'max'.padStart(10)}`
  );
  console.log(`  ${'-'.repeat(80)}`);

  for (const [name, latency] of endpoints) {
    console.log(
      `  ${name.padEnd(25)} ${formatMs(latency.p50).padStart(10)} ${formatMs(latency.p95).padStart(10)} ${formatMs(latency.p99).padStart(10)} ${formatMs(latency.max).padStart(10)}`
    );
  }

  console.log(`  ${'-'.repeat(80)}`);
}

/**
 * Runs the latency benchmark
 */
async function runLatencyBenchmark(config: BenchmarkConfig): Promise<LatencyResult> {
  printHeader('Latency Benchmark');

  printInfo('Target URL', config.targetUrl);
  printInfo('Duration per endpoint', `${config.duration} seconds`);
  printInfo('Connections', '10 (low for accurate latency)');

  // Use fewer connections for latency testing to get accurate measurements
  const connections = 10;
  const duration = config.duration;

  const endpoints = new Map<string, LatencyPercentiles>();

  // Benchmark different endpoints
  const endpointConfigs = [
    { path: '/api/health', name: 'GET /api/health' },
    { path: '/api/users', name: 'GET /api/users' },
    { path: '/trpc/health.getHealth', name: 'tRPC health.getHealth' },
  ];

  for (const endpoint of endpointConfigs) {
    const url = `${config.targetUrl}${endpoint.path}`;
    const latency = await benchmarkEndpoint(url, endpoint.name, connections, duration);
    endpoints.set(endpoint.name, latency);
  }

  // Calculate aggregate latency (from health endpoint as primary)
  const primaryLatency = endpoints.get('GET /api/health');
  if (!primaryLatency) {
    throw new Error('Primary endpoint benchmark failed');
  }

  const meetsTarget = primaryLatency.p50 < TARGET_METRICS.latencyP50;

  // Print results
  console.log('\n  Summary:');
  printMetric(
    'Latency p50 (primary)',
    formatMs(primaryLatency.p50),
    `< ${TARGET_METRICS.latencyP50} ms`,
    meetsTarget
  );
  printMetric(
    'Latency p95 (primary)',
    formatMs(primaryLatency.p95),
    '< 10 ms',
    primaryLatency.p95 < 10
  );
  printMetric(
    'Latency p99 (primary)',
    formatMs(primaryLatency.p99),
    '< 20 ms',
    primaryLatency.p99 < 20
  );

  printLatencyTable(endpoints);

  return {
    latency: primaryLatency,
    endpoints,
    meetsTarget,
  };
}

/**
 * Main entry point - can be run standalone or imported
 */
async function main(): Promise<LatencyResult | null> {
  const config = createConfig({
    duration: 5, // Shorter duration for latency tests
  });

  // Check if server is already running
  const serverAlreadyRunning = await waitForServer(config.targetUrl, 2000);

  let serverProcess = null;

  if (!serverAlreadyRunning) {
    console.log('\n  Starting playground server...');

    serverProcess = spawnServer(PLAYGROUND_DIR, 'node', ['dist/index.js'], { USE_MOCK_DB: 'true' });

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
    const result = await runLatencyBenchmark(config);
    return result;
  } finally {
    if (serverProcess) {
      console.log('\n  Stopping server...');
      await stopServer(serverProcess);
    }
  }
}

// Run if executed directly
const isMain = process.argv[1]?.includes('latency');
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

export { runLatencyBenchmark, main as runLatencyBenchmarkStandalone };
export type { LatencyResult };
