/**
 * VeloxTS Benchmarks
 *
 * Performance benchmarking suite for the VeloxTS framework.
 *
 * @module @veloxts/benchmarks
 */

// Types
export * from './types.js';

// Utilities
export * from './utils.js';

// Individual benchmarks
export { runThroughputBenchmark } from './benchmarks/throughput.js';
export { runLatencyBenchmark } from './benchmarks/latency.js';
export { runMemoryBenchmark } from './benchmarks/memory.js';
export { runStartupBenchmark } from './benchmarks/startup.js';

// Re-export types from benchmarks
export type { LatencyResult } from './benchmarks/latency.js';
export type { MemoryBenchmarkResult } from './benchmarks/memory.js';
export type { StartupBenchmarkResult } from './benchmarks/startup.js';
