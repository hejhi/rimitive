# Lattice Performance Benchmarks

Comprehensive performance benchmarks for the Lattice framework, measuring core composition patterns, adapter performance, and memory usage.

## Benchmark Modes

Lattice provides two benchmark modes to measure different aspects of performance:

- **Raw Mode**: Disables memoization to measure pure computational performance
- **Real Mode**: Enables memoization to measure real-world cached performance

See [BENCHMARKING.md](./BENCHMARKING.md) for detailed information about the two modes.

## Running Benchmarks

```bash
# Run all benchmarks (both raw and real modes)
pnpm --filter @lattice/benchmarks bench

# Run raw performance benchmarks (no caching)
pnpm --filter @lattice/benchmarks bench:raw

# Run real-world benchmarks (with caching)
pnpm --filter @lattice/benchmarks bench:real

# Run specific benchmark file
pnpm --filter @lattice/benchmarks bench core-composition

# Generate JSON reports for CI
pnpm --filter @lattice/benchmarks bench:ci

# Compare against baseline
pnpm --filter @lattice/benchmarks bench:compare
pnpm --filter @lattice/benchmarks bench:compare:raw   # Compare raw results
pnpm --filter @lattice/benchmarks bench:compare:real  # Compare real results
```

## Benchmark Categories

### 1. Core Composition (`core-composition.bench.ts`)
Tests the performance of Lattice's core primitives:
- **Slice creation and execution**: Simple and complex state access
- **Compose function**: Single and multiple dependencies, deep nesting
- **Component creation**: Full component initialization overhead
- **Sequential operations**: Performance under load

### 2. Adapter Performance (`adapter-performance.bench.ts`)
Compares performance across different adapters:
- **Store creation**: Initialization overhead for each adapter
- **State updates**: Sequential and bulk update performance
- **View computation**: Filtered views and aggregated stats
- **Subscription handling**: Multiple subscribers and complex selectors

### 3. Memory Usage (`memory-usage.bench.ts`)
Measures memory efficiency:
- **Slice creation overhead**: Memory cost of creating many slices
- **Compose chains**: Memory impact of deep composition
- **Large state handling**: Performance with megabytes of data
- **Subscription lifecycle**: Memory cleanup effectiveness

### 4. Cache Performance (`cache-performance.bench.ts`)
Measures memoization effectiveness:
- **Cache hit rates**: Repeated parameter access patterns
- **Hot path optimization**: 80/20 access pattern simulation
- **Cache memory pressure**: Behavior with many unique parameters
- **Performance gains**: Expensive computation caching benefits

## Performance Targets

Based on the benchmarks, Lattice aims for:

- **Slice execution**: < 1μs for simple selectors
- **Compose overhead**: < 10% vs direct execution
- **Store creation**: < 1ms for typical components
- **State updates**: > 10,000 updates/second
- **Memory overhead**: < 100 bytes per slice

## Continuous Performance Monitoring

### Setting a Baseline

```bash
# Run benchmarks and save as baseline
pnpm --filter @lattice/benchmarks bench:ci
mv bench-results.json bench-baseline.json
```

### Comparing Performance

The comparison script will:
- Show performance changes for each benchmark
- Highlight regressions > 10% in red
- Show improvements > 5% in green
- Exit with error code if regressions are found

### CI Integration

```yaml
# Example GitHub Actions workflow
- name: Run benchmarks
  run: pnpm --filter @lattice/benchmarks bench:ci
  
- name: Compare with baseline
  run: pnpm --filter @lattice/benchmarks bench:compare
  
- name: Upload results
  uses: actions/upload-artifact@v3
  with:
    name: benchmark-results
    path: packages/benchmarks/bench-results.json
```

## Writing New Benchmarks

Use Vitest's `bench` function:

```typescript
import { bench, describe } from 'vitest';

describe('My Feature', () => {
  bench('operation name', () => {
    // Code to benchmark
    // Should be synchronous and deterministic
  });
});
```

Guidelines:
- Keep benchmarks focused on a single operation
- Use realistic data sizes and patterns
- Avoid I/O operations in benchmarks
- Include both typical and edge cases
- Name benchmarks descriptively

## Interpreting Results

- **ns** (nanoseconds): 1 billionth of a second
- **μs** (microseconds): 1 millionth of a second  
- **ms** (milliseconds): 1 thousandth of a second

For reference:
- 1μs = 1,000ns (can do ~1 million ops/second)
- 1ms = 1,000μs (can do ~1 thousand ops/second)
- 16ms = 1 frame at 60fps

## Optimization Tips

Based on benchmark findings:

1. **Prefer simple slices**: Complex computations in slices impact performance
2. **Limit compose depth**: Each level adds overhead
3. **Cache expensive computations**: Use memoization for complex views
4. **Batch updates**: Multiple state changes should be batched
5. **Clean up subscriptions**: Prevent memory leaks with proper cleanup