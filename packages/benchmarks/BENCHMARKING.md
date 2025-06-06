# Lattice Benchmarking Guide

## Overview

Lattice provides comprehensive benchmarking to measure both raw computational performance and real-world cached performance. This dual approach gives insights into:

- **Algorithm efficiency** (raw mode)
- **Real-world performance** (cached mode)
- **Cache effectiveness** (comparison between modes)

## Benchmark Modes

### Raw Mode (Computation Performance)
Disables memoization to measure the actual computational cost of view functions.

```bash
pnpm bench:raw
```

**What it measures:**
- Pure algorithmic performance
- Worst-case scenario (no cache hits)
- Memory allocation patterns
- Computational complexity

**When to use:**
- Optimizing view function algorithms
- Comparing computational efficiency between implementations
- Identifying performance bottlenecks in calculations

### Real Mode (Cached Performance)
Runs with memoization enabled to measure real-world performance.

```bash
pnpm bench:real
```

**What it measures:**
- Cache hit rates
- Memory usage with caching
- Typical application performance
- Cache eviction behavior

**When to use:**
- Understanding real-world performance
- Optimizing cache strategies
- Measuring actual user experience

## Running Benchmarks

### All Benchmarks
```bash
# Run both raw and real benchmarks
pnpm bench

# CI mode with JSON output
pnpm bench:ci
```

### Specific Modes
```bash
# Only raw performance
pnpm bench:raw

# Only cached performance  
pnpm bench:real
```

### Comparing Results
```bash
# Compare any benchmark results
pnpm bench:compare

# Compare specific modes
pnpm bench:compare:raw    # Compare raw results
pnpm bench:compare:real   # Compare cached results
```

## Benchmark Suites

### Core Benchmarks
- `adapter-performance.bench.ts` - Cross-adapter performance comparison
- `core-composition.bench.ts` - Slice composition and execution
- `memory-usage.bench.ts` - Memory efficiency and cleanup
- `react-adapter.bench.tsx` - React integration performance
- `real-world.bench.ts` - Realistic application scenarios

### Cache-Specific Benchmarks
- `cache-performance.bench.ts` - Memoization effectiveness
  - Cache hit rates with repeated parameters
  - Hot path optimization (80/20 access patterns)
  - Cache memory pressure scenarios
  - Expensive computation benefits

## Interpreting Results

### Raw vs Real Performance Delta

The difference between raw and real mode indicates cache effectiveness:

```
Raw time:  100ms (no caching)
Real time: 10ms  (with caching)
→ 90% performance improvement from caching
```

### Key Metrics

1. **Cache Hit Rate** (Real mode)
   - High hit rate = effective memoization
   - Low hit rate = consider cache strategy

2. **Memory Usage** 
   - Raw: Baseline memory without caches
   - Real: Additional memory from caching

3. **Throughput**
   - Operations per second
   - Higher is better

## Performance Regression Detection

The benchmark suite automatically detects performance regressions:

- **>10% regression** = Warning (yellow)
- **>20% regression** = Error (red)
- **Improvement** = Success (green)

## Best Practices

1. **Run both modes** when optimizing performance
2. **Profile memory** in real mode to ensure caches don't leak
3. **Test various access patterns** (sequential, random, hot paths)
4. **Monitor cache effectiveness** by comparing modes
5. **Set performance budgets** based on real mode results

## Environment Variables

- `LATTICE_DISABLE_MEMOIZATION=true` - Disables view memoization
- `NODE_OPTIONS=--max-old-space-size=4096` - Increases heap for large benchmarks

## Continuous Integration

CI runs output JSON results for tracking:
- `bench-results-raw.json` - Raw performance data
- `bench-results-real.json` - Cached performance data

Use these for:
- Performance tracking over time
- Regression detection in PR checks
- Performance dashboards