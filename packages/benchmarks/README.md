# Lattice Performance Benchmarks

Performance benchmarks for the Lattice framework, focusing on runtime characteristics that impact real application performance.

## Benchmark Categories

### 1. Adapter Overhead
Measures the performance impact of using Lattice wrappers around native state management libraries:
- Raw Zustand vs Zustand + Lattice
- Raw Redux vs Redux + Lattice
- State updates, subscriptions, and store creation

### 2. Head-to-Head Comparisons
Direct performance comparisons between similar libraries:
- store-react vs Zustand (React hooks)
- store-react vs Zustand (vanilla)
- Hook creation, updates, and subscription performance

### 3. Adapter Rankings
Compares all Lattice adapters against each other:
- State update performance
- Complex state operations
- Subscription handling
- Store creation speed

### 4. Real-World Scenarios
Simulates actual application usage patterns:
- **E-commerce Cart**: Product management, cart operations, user sessions, checkout flow
- **Todo App**: CRUD operations, filtering, search, tag management

### 5. Memory Usage Patterns
Tests memory characteristics and potential leaks:
- Large state trees (1000+ items)
- Subscription cleanup
- Rapid store creation/destruction

## Running Benchmarks

### Basic Commands

```bash
# Run all benchmarks
pnpm bench

# Run benchmarks without memoization (raw performance)
pnpm bench:raw

# Run benchmarks with memoization (real-world performance)
pnpm bench:real
```

### CI Commands

```bash
# Run benchmarks and output JSON results
pnpm bench:ci

# Compare benchmark results
pnpm bench:compare bench-results.json

# Generate HTML report
pnpm bench:report
```

### Running Specific Benchmarks

```bash
# Run only overhead benchmarks
pnpm vitest bench src/suites/overhead.bench.ts

# Run only adapter rankings
pnpm vitest bench src/suites/adapter-rankings.bench.ts
```

## Understanding Results

### Key Metrics

1. **ops/sec**: Operations per second (higher is better)
2. **±%**: Margin of error
3. **samples**: Number of samples taken

### What to Look For

- **Overhead**: Lattice should add minimal overhead (<5%) to raw adapters
- **store-react vs Zustand**: store-react should be competitive or faster for React use cases
- **Adapter Rankings**: Performance differences between adapters should reflect their underlying implementations

### Performance Goals

1. **Minimal Overhead**: Lattice abstractions should not significantly impact performance
2. **Predictable Performance**: Consistent performance across different usage patterns
3. **Memory Efficiency**: No memory leaks or excessive allocations
4. **Scalability**: Performance should scale linearly with state size

## Benchmark Implementation Notes

### Warmup
Each benchmark suite includes a warmup phase to ensure JIT optimization.

### Iterations
- Simple operations: 10,000 iterations
- Complex operations: 100-1,000 iterations
- Memory tests: Scaled appropriately

### Fair Comparisons
- Same operations across all adapters
- Equivalent state structures
- Identical business logic

## Adding New Benchmarks

1. Create a new file in `src/suites/`
2. Import it in `src/index.bench.ts`
3. Follow the existing patterns:
   ```typescript
   describe('Category', () => {
     bench('adapter - operation', () => {
       // Setup
       // Operations
       // Return result for verification
     });
   });
   ```

## Interpreting Results

### Expected Patterns

1. **Zustand**: Generally fastest due to minimal abstraction
2. **Redux**: Slower due to immutability and middleware
3. **store-react**: Optimized for React, competitive with Zustand

### Red Flags

- Lattice overhead >10%
- Memory benchmarks showing growth patterns
- Subscription performance degradation with scale

## Contributing

When adding new features to Lattice:
1. Add corresponding benchmarks
2. Run benchmarks before and after changes
3. Document any performance impacts
4. Optimize if regression >5%