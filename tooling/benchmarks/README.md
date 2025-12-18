# VeloxTS Performance Benchmarks

Performance benchmarking suite for the VeloxTS framework.

## Target Metrics

From the ROADMAP, our performance targets are:

| Metric | Target | Description |
|--------|--------|-------------|
| Latency p50 | < 5ms | 50th percentile request latency |
| Throughput | > 20k req/s | Requests per second under load |
| Memory Baseline | < 80MB | RSS memory usage at idle |
| Startup Time | < 1 second | Cold start to first request |

## Running Benchmarks

### Prerequisites

1. Build the playground app first:

```bash
pnpm build
```

2. Ensure no other server is running on port 3030

### Run All Benchmarks

```bash
# From monorepo root
pnpm benchmark

# Or from benchmarks directory
cd tooling/benchmarks
pnpm bench
```

### Run Individual Benchmarks

```bash
# Throughput (requests per second)
pnpm bench:throughput

# Latency (response times)
pnpm bench:latency

# Memory usage
pnpm bench:memory

# Startup time
pnpm bench:startup
```

## Benchmark Details

### Throughput Benchmark

Measures requests per second using autocannon with:
- 100 concurrent connections
- 10 pipelining
- 10 second duration (after 3 second warmup)

Tests the `/api/health` endpoint which represents minimal framework overhead.

### Latency Benchmark

Measures response time percentiles:
- p50, p75, p90, p95, p99, max
- Tests multiple endpoints (REST and tRPC)
- Uses 10 connections for accurate measurement

### Memory Benchmark

Measures memory usage:
- Baseline (after startup, before load)
- Under load (during 100 connection benchmark)
- After load (post-GC recovery)

**Note**: Accurate memory measurement requires server-side instrumentation. Consider adding a `/debug/memory` endpoint for production monitoring.

### Startup Benchmark

Measures cold start time:
- Time from process spawn to first successful health check
- Runs 5 iterations and calculates average
- Reports fastest, slowest, and standard deviation

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BENCH_PORT` | 3030 | Server port |
| `BENCH_DURATION` | 10 | Throughput test duration (seconds) |
| `BENCH_CONNECTIONS` | 100 | Concurrent connections |

## Output

Results are saved to `benchmark-results-YYYY-MM-DD.json` with the following structure:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "nodeVersion": "v20.10.0",
  "platform": "darwin",
  "throughput": {
    "requestsPerSecond": 25000,
    "latency": { "p50": 2.5, "p95": 8.0, ... },
    "meetsTarget": true
  },
  "memory": {
    "heapUsed": 45,
    "rss": 75,
    "meetsTarget": true
  },
  "startup": {
    "startupTimeMs": 450,
    "meetsTarget": true
  }
}
```

## Methodology

### Test Environment

For consistent results:
- Run on dedicated hardware (not shared CI)
- Close other applications
- Disable CPU throttling
- Use same Node.js version

### Statistical Significance

- Throughput: 10 second test after warmup
- Startup: 5 iterations with average
- Latency: Reports full percentile distribution

### Baseline Comparisons

To track performance over time:
1. Run benchmarks before changes
2. Save results with git commit hash
3. Run benchmarks after changes
4. Compare using JSON diff

## Improving Performance

If benchmarks fail targets, consider:

### Latency
- Profile with `node --prof` or clinic.js
- Check for synchronous operations in request path
- Review middleware order (early returns first)

### Throughput
- Enable Fastify JSON serialization schemas
- Use connection pooling for database
- Consider worker threads for CPU-bound tasks

### Memory
- Check for memory leaks with `--inspect`
- Review closure captures
- Implement request-scoped cleanup

### Startup
- Lazy load heavy dependencies
- Use dynamic imports for optional features
- Pre-compile TypeScript

## Integration with CI

Example GitHub Actions workflow:

```yaml
benchmark:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - run: pnpm install
    - run: pnpm build
    - run: pnpm benchmark
    - uses: actions/upload-artifact@v3
      with:
        name: benchmark-results
        path: tooling/benchmarks/benchmark-results-*.json
```

## Baseline Results (v0.3.3)

Initial benchmark results from December 2024:

| Metric | Result | Target | Status |
|--------|--------|--------|--------|
| **Throughput** | 34,747 req/s | > 20,000 req/s | PASS |
| **Latency p50** | < 1ms (under low load) | < 5ms | PASS |
| **Latency p50** | 22ms (under high load, 100 conn + 10 pipelining) | - | Expected |
| **Memory (baseline)** | ~75 MB RSS | < 80 MB | PASS |
| **Memory (under load)** | ~95 MB RSS | < 120 MB | PASS |
| **Startup Time** | 608 ms avg | < 1000 ms | PASS |

### Test Environment
- **Node.js**: v22.x
- **Platform**: macOS (darwin)
- **Hardware**: Apple Silicon

### Notes

1. **Throughput benchmark** uses high concurrency (100 connections, 10 pipelining) which increases latency but maximizes throughput.

2. **Latency benchmark** uses lower concurrency (10 connections) for accurate latency measurement. Under these conditions, p50 latency is sub-millisecond.

3. **Memory benchmark** currently provides estimates. For accurate server-side memory measurement, add a `/debug/memory` endpoint to expose `process.memoryUsage()`.

4. **Startup time** is measured as cold-start to first successful health check response.

## Troubleshooting

### Server won't start
- Check if port 3030 is already in use: `lsof -i :3030`
- Verify playground is built: `ls apps/playground/dist/`

### Low throughput numbers
- Check system load: `htop` or Activity Monitor
- Disable antivirus scanning
- Close browsers and other apps

### Inconsistent results
- Run multiple times and compare
- Check for background processes
- Consider dedicated benchmark machine
