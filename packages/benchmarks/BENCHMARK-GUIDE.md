# Lattice Benchmark Guide

## Overview

The Lattice benchmark suite provides comprehensive performance comparisons between different state management solutions (Lattice, Zustand, Redux) to help developers make informed decisions.

## Running Benchmarks

### Quick Start

```bash
# Run all benchmarks and generate dashboard
pnpm bench:report

# Run only raw performance tests (no memoization)
pnpm bench:report:raw

# Run only real-world tests (with memoization)
pnpm bench:report:real
```

### Individual Commands

```bash
# Run benchmarks without generating reports
pnpm bench         # Both raw and real
pnpm bench:raw     # Without memoization
pnpm bench:real    # With memoization

# Generate dashboard from existing results
pnpm dashboard bench-results-raw.json
```

## Understanding the Dashboard

The performance dashboard provides:

1. **Overall Performance Leader** - Shows which framework wins the most benchmarks
2. **Performance by Use Case** - Detailed comparisons for specific scenarios:
   - Initial Setup Cost
   - Single Item Updates
   - Bulk Operations
   - Computed Values
   - Subscription Overhead
   - Real-World Scenarios

3. **Recommendations** - Guidance on which framework to use based on your needs

## Benchmark Categories

### Initial Setup Cost
Tests how quickly you can create a store and start using it. Important for:
- Applications with many dynamic stores
- Micro-frontends
- Component-level state

### Single Item Updates
Measures performance when updating individual items. Critical for:
- Real-time applications
- Interactive UIs
- Form handling

### Bulk Operations
Tests updating many items at once. Important for:
- Data grids
- Batch processing
- Large dataset manipulation

### Computed Values
Benchmarks derived state and filtered views. Key for:
- Complex UI calculations
- Data filtering
- Aggregations

### Subscription Overhead
Tests how performance scales with many subscribers. Critical for:
- Large applications
- Many connected components
- Fine-grained subscriptions

### Real-World Scenarios
Simulates common application patterns:
- E-commerce shopping carts
- Real-time dashboards
- Typical CRUD operations

## Interpreting Results

- **Lower times are better** - All measurements are in time units (ns, μs, ms)
- **Higher ops/sec is better** - Operations per second
- **Consider your use case** - The "best" framework depends on your specific needs
- **Raw vs Real mode** - Raw shows computation cost, Real shows with optimizations

## Adding New Benchmarks

1. Add your benchmark to the appropriate file in `src/`
2. Follow the existing pattern for test names
3. Include all frameworks you want to compare
4. Run `pnpm bench:report` to see results

## Tips

- Run benchmarks multiple times for consistency
- Close other applications for more accurate results
- Consider both raw and real performance
- Look at the specific operations you'll use most