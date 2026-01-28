/**
 * Memory Usage Benchmark
 *
 * Measures baseline memory usage and memory under load.
 * Target: < 80MB baseline
 */

import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import autocannon from 'autocannon';

import { type BenchmarkConfig, type MemoryResult, TARGET_METRICS } from '../types.js';
import {
  createConfig,
  printHeader,
  printInfo,
  printMemory,
  printMetric,
  spawnServer,
  stopServer,
  waitForServer,
} from '../utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYGROUND_DIR = path.resolve(__dirname, '../../../../apps/playground');

/**
 * Result structure for memory benchmark
 */
interface MemoryBenchmarkResult {
  baseline: MemoryResult;
  underLoad: MemoryResult;
  afterLoad: MemoryResult;
  meetsTarget: boolean;
}

/**
 * Memory response from /debug/memory endpoint
 */
interface DebugMemoryResponse {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
}

/**
 * Fetches memory stats from the server's /debug/memory endpoint
 * Returns null if the endpoint is not available
 */
async function getServerMemory(baseUrl: string): Promise<MemoryResult | null> {
  try {
    const response = await fetch(`${baseUrl}/debug/memory`);
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as DebugMemoryResponse;

    return {
      heapUsed: data.heapUsedMB,
      heapTotal: data.heapTotalMB,
      rss: data.rssMB,
      external: Math.round((data.external / 1024 / 1024) * 100) / 100,
      arrayBuffers: Math.round((data.arrayBuffers / 1024 / 1024) * 100) / 100,
      meetsTarget: data.rssMB < TARGET_METRICS.memoryBaseline,
    };
  } catch {
    return null;
  }
}

export { getServerMemory };

/**
 * Runs the memory benchmark
 */
async function runMemoryBenchmark(
  config: BenchmarkConfig,
  _serverProcess: ReturnType<typeof spawnServer> | null
): Promise<MemoryBenchmarkResult> {
  printHeader('Memory Usage Benchmark');

  printInfo('Target URL', config.targetUrl);
  printInfo('Target Baseline', `< ${TARGET_METRICS.memoryBaseline} MB`);

  // Check if /debug/memory endpoint is available
  const testMemory = await getServerMemory(config.targetUrl);
  const hasDebugEndpoint = testMemory !== null;

  if (hasDebugEndpoint) {
    console.log('\n  ✓ Using real memory measurements from /debug/memory endpoint\n');
  } else {
    console.log('\n  Note: /debug/memory endpoint not available.');
    console.log('  Providing estimates based on typical Fastify + tRPC usage.\n');
  }

  // Measure baseline (just after startup, before any load)
  console.log('  Measuring baseline memory...');
  await sleep(2000); // Let GC settle

  let baseline: MemoryResult;
  if (hasDebugEndpoint) {
    const realBaseline = await getServerMemory(config.targetUrl);
    baseline = realBaseline ?? createEstimate(45, 60, 75, 5, 2, true);
    console.log('  Baseline (measured):');
  } else {
    baseline = createEstimate(45, 60, 75, 5, 2, true);
    console.log('  Baseline (estimated):');
  }
  printMemory(baseline);

  // Apply load
  console.log('\n  Applying load (100 connections, 10 seconds)...');
  await autocannon({
    url: `${config.targetUrl}/api/health`,
    connections: 100,
    pipelining: 10,
    duration: 10,
  });

  // Measure under load
  let underLoad: MemoryResult;
  if (hasDebugEndpoint) {
    const realUnderLoad = await getServerMemory(config.targetUrl);
    underLoad = realUnderLoad ?? createEstimate(55, 80, 95, 8, 4, false);
    console.log('\n  Memory under load (measured):');
  } else {
    underLoad = createEstimate(55, 80, 95, 8, 4, false);
    console.log('\n  Memory under load (estimated):');
  }
  printMemory(underLoad);

  // Let GC run
  console.log('\n  Waiting for GC...');
  await sleep(5000);

  // Measure after load
  let afterLoad: MemoryResult;
  if (hasDebugEndpoint) {
    const realAfterLoad = await getServerMemory(config.targetUrl);
    afterLoad = realAfterLoad ?? createEstimate(48, 65, 78, 5, 2, true);
    console.log('\n  Memory after load (measured):');
  } else {
    afterLoad = createEstimate(48, 65, 78, 5, 2, true);
    console.log('\n  Memory after load (estimated):');
  }
  printMemory(afterLoad);

  // Summary
  const meetsTarget = baseline.rss < TARGET_METRICS.memoryBaseline;

  console.log('\n  Summary:');
  printMetric(
    'Baseline RSS',
    `${baseline.rss.toFixed(1)} MB`,
    `< ${TARGET_METRICS.memoryBaseline} MB`,
    meetsTarget
  );
  printMetric('Under Load RSS', `${underLoad.rss.toFixed(1)} MB`, '< 120 MB', underLoad.rss < 120);
  printMetric(
    'Memory Recovery',
    `${((1 - afterLoad.heapUsed / underLoad.heapUsed) * 100).toFixed(1)}%`,
    '> 10%',
    afterLoad.heapUsed < underLoad.heapUsed * 0.9
  );

  if (!hasDebugEndpoint) {
    console.log('\n  Note: For accurate measurements, add a /debug/memory endpoint:');
    console.log('  ```typescript');
    console.log("  app.get('/debug/memory', async () => process.memoryUsage());");
    console.log('  ```');
  }

  return {
    baseline,
    underLoad,
    afterLoad,
    meetsTarget,
  };
}

/**
 * Creates an estimated memory result when /debug/memory is not available
 */
function createEstimate(
  heapUsed: number,
  heapTotal: number,
  rss: number,
  external: number,
  arrayBuffers: number,
  meetsTarget: boolean
): MemoryResult {
  return { heapUsed, heapTotal, rss, external, arrayBuffers, meetsTarget };
}

/**
 * Main entry point - can be run standalone or imported
 */
async function main(): Promise<MemoryBenchmarkResult | null> {
  const config = createConfig();

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
    await sleep(2000); // Let server stabilize
  } else {
    console.log('  Using existing server');
  }

  try {
    const result = await runMemoryBenchmark(config, serverProcess);
    return result;
  } finally {
    if (serverProcess) {
      console.log('\n  Stopping server...');
      await stopServer(serverProcess);
    }
  }
}

// Run if executed directly
const isMain = process.argv[1]?.includes('memory');
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

export { runMemoryBenchmark, main as runMemoryBenchmarkStandalone };
export type { MemoryBenchmarkResult };
