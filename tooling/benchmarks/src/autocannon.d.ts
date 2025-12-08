/**
 * Type declarations for autocannon
 *
 * Autocannon is a fast HTTP/1.1 benchmarking tool written in Node.js.
 */

declare module 'autocannon' {
  export interface AutocannonOptions {
    /** Target URL */
    url: string;
    /** Number of concurrent connections */
    connections?: number;
    /** Duration of test in seconds */
    duration?: number;
    /** Amount of pipelining requests */
    pipelining?: number;
    /** Timeout in seconds */
    timeout?: number;
    /** Number of requests to make (overrides duration) */
    amount?: number;
    /** HTTP method */
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
    /** Request body */
    body?: string | Buffer;
    /** Request headers */
    headers?: Record<string, string>;
    /** Setup request function */
    setupClient?: (client: unknown) => void;
    /** Maximum number of requests per second */
    maxConnectionRequests?: number;
    /** Maximum overall requests */
    maxOverallRequests?: number;
    /** Number of workers */
    workers?: number;
  }

  export interface LatencyStats {
    /** Average latency in ms */
    average: number;
    /** Mean latency in ms */
    mean: number;
    /** Standard deviation */
    stddev: number;
    /** Minimum latency */
    min: number;
    /** Maximum latency */
    max: number;
    /** 50th percentile (p50) */
    p50: number;
    /** 75th percentile (p75) */
    p75: number;
    /** 90th percentile (p90) */
    p90: number;
    /** 95th percentile (p95) */
    p95: number;
    /** 99th percentile (p99) */
    p99: number;
    /** 99.9th percentile (p999) */
    p999: number;
    /** 99.99th percentile (p9999) */
    p9999: number;
  }

  export interface RequestStats {
    /** Average requests per second */
    average: number;
    /** Mean requests per second */
    mean: number;
    /** Standard deviation */
    stddev: number;
    /** Minimum requests per second */
    min: number;
    /** Maximum requests per second */
    max: number;
    /** Total requests made */
    total: number;
    /** P50 requests per second */
    p50: number;
    /** P75 requests per second */
    p75: number;
    /** P90 requests per second */
    p90: number;
    /** P95 requests per second */
    p95: number;
    /** P99 requests per second */
    p99: number;
  }

  export interface ThroughputStats {
    /** Average throughput in bytes/sec */
    average: number;
    /** Mean throughput */
    mean: number;
    /** Standard deviation */
    stddev: number;
    /** Minimum throughput */
    min: number;
    /** Maximum throughput */
    max: number;
    /** Total bytes transferred */
    total: number;
    /** P50 throughput */
    p50: number;
    /** P75 throughput */
    p75: number;
    /** P90 throughput */
    p90: number;
    /** P95 throughput */
    p95: number;
    /** P99 throughput */
    p99: number;
  }

  export interface AutocannonResult {
    /** Title of the benchmark */
    title?: string;
    /** URL that was benchmarked */
    url: string;
    /** Socket path (if used) */
    socketPath?: string;
    /** Number of connections */
    connections: number;
    /** Sampleint value */
    sampleInt: number;
    /** Pipelining factor */
    pipelining: number;
    /** Duration of test in seconds */
    duration: number;
    /** Number of samples */
    samples: number;
    /** Start time */
    start: Date;
    /** End time */
    finish: Date;
    /** Total number of errors */
    errors: number;
    /** Number of timeouts */
    timeouts: number;
    /** Number of mismatches */
    mismatches: number;
    /** Number of non-2xx responses */
    non2xx: number;
    /** Number of resets */
    resets: number;
    /** Status code distribution */
    statusCodeStats: Record<string, { count: number }>;
    /** Latency statistics */
    latency: LatencyStats;
    /** Request statistics */
    requests: RequestStats;
    /** Throughput statistics */
    throughput: ThroughputStats;
  }

  /**
   * Run an autocannon benchmark
   */
  function autocannon(options: AutocannonOptions): Promise<AutocannonResult>;

  export default autocannon;
}
