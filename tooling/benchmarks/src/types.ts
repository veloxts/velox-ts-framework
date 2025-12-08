/**
 * Benchmark Types and Interfaces
 *
 * Core type definitions for the VeloxTS benchmarking suite.
 */

/**
 * Target performance metrics from ROADMAP
 */
export const TARGET_METRICS = {
  /** Request latency p50 target in ms */
  latencyP50: 5,
  /** Throughput target in requests per second */
  throughput: 20000,
  /** Memory baseline target in MB */
  memoryBaseline: 80,
  /** Startup time target in ms */
  startupTime: 1000,
} as const;

/**
 * Latency percentile data
 */
export interface LatencyPercentiles {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  min: number;
  mean: number;
  stddev: number;
}

/**
 * Throughput benchmark results
 */
export interface ThroughputResult {
  /** Requests per second */
  requestsPerSecond: number;
  /** Total requests made */
  totalRequests: number;
  /** Duration of benchmark in seconds */
  duration: number;
  /** Number of concurrent connections */
  connections: number;
  /** Error count */
  errors: number;
  /** Error rate as percentage */
  errorRate: number;
  /** Latency percentiles */
  latency: LatencyPercentiles;
  /** Whether target was met */
  meetsTarget: boolean;
}

/**
 * Memory benchmark results
 */
export interface MemoryResult {
  /** Heap used in MB */
  heapUsed: number;
  /** Heap total in MB */
  heapTotal: number;
  /** External memory in MB */
  external: number;
  /** Array buffers in MB */
  arrayBuffers: number;
  /** Resident set size in MB */
  rss: number;
  /** Whether target was met */
  meetsTarget: boolean;
}

/**
 * Startup time benchmark results
 */
export interface StartupResult {
  /** Startup time in milliseconds */
  startupTimeMs: number;
  /** Time to first request response */
  timeToFirstResponse: number;
  /** Whether target was met */
  meetsTarget: boolean;
}

/**
 * Combined benchmark results
 */
export interface BenchmarkResults {
  timestamp: string;
  nodeVersion: string;
  platform: string;
  throughput?: ThroughputResult;
  memory?: MemoryResult;
  startup?: StartupResult;
}

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  /** Target URL for HTTP benchmarks */
  targetUrl: string;
  /** Port for the benchmark server */
  port: number;
  /** Duration of throughput benchmark in seconds */
  duration: number;
  /** Number of concurrent connections */
  connections: number;
  /** Number of pipelining requests */
  pipelining: number;
  /** Warmup duration in seconds */
  warmupDuration: number;
  /** Number of startup iterations for averaging */
  startupIterations: number;
}

/**
 * Default benchmark configuration
 */
export const DEFAULT_CONFIG: BenchmarkConfig = {
  targetUrl: 'http://127.0.0.1:3210',
  port: 3210,
  duration: 10,
  connections: 100,
  pipelining: 10,
  warmupDuration: 3,
  startupIterations: 5,
};
