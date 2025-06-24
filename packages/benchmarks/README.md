# Lattice Performance Benchmarks

Comprehensive performance benchmarks comparing Lattice against other reactive state management solutions.

## 🎯 What These Benchmarks Measure

### Performance Metrics

**1. Execution Time** (via Vitest benchmarks)
- Raw operations per second
- Update cycle performance
- Subscription notification overhead

**2. Memory Usage**
- Heap allocation during setup
- Memory growth during operations  
- Cleanup efficiency
- Memory retention patterns

**3. Bundle Size Impact**
- Core library size contribution
- Tree-shaking effectiveness
- Real-world bundle impact

**4. Reactivity Efficiency**
- Unnecessary computation prevention
- Subscription granularity
- Update propagation costs

## 🔧 Running Benchmarks

### Quick Start
```bash
# Run all benchmarks with enhanced metrics
pnpm bench:all

# Memory-focused benchmarks (requires Node.js --expose-gc)
pnpm bench:memory

# Bundle size analysis
pnpm bench:bundle

# Standard performance benchmarks
pnpm bench
```

### Individual Benchmark Suites
```bash
# Lattice-specific benchmarks
pnpm bench:lattice

# React store adapter benchmarks  
pnpm bench:store-react
```

### Detailed Memory Analysis
```bash
# Enable full memory tracking (recommended)
node --expose-gc scripts/run-chunked-benchmarks.js real lattice

# With verbose output for debugging
pnpm bench:lattice --reporter=verbose
```

## 📊 Understanding Results

### Execution Time
- **Higher ops/sec = Better performance**
- Look for consistent performance across iterations
- Compare relative performance between solutions

### Memory Usage
- **Lower memory delta = Better efficiency**
- Monitor memory growth patterns
- Check for memory leaks in teardown

### Bundle Size
- **Smaller size = Better for production**
- Consider gzipped size for realistic impact
- Evaluate size vs. feature trade-offs

### Computation Efficiency
- **Fewer computations = Better optimization**
- Ideal: Only relevant updates trigger recalculation
- Watch for over-reactive patterns

## 🧪 Benchmark Scenarios

### Fine-Grained Reactivity
**File:** `fine-grained-reactivity.bench.ts`

Tests how well each system handles selective updates in large state trees.

**Scenario:** 100 independent counters, cyclical updates
- **Lattice:** Slice-based subscriptions
- **MobX:** Computed observables per counter
- **Focus:** Memory efficiency and update targeting

### Svelte Integration
**File:** `svelte-reactivity.bench.ts` 

Compares Lattice's Svelte utilities against native Svelte stores.

**Scenario:** Complex dashboard state with mixed update patterns
- **Svelte:** Traditional derived stores
- **Lattice:** combineSlices utilities
- **Focus:** Over-reactivity prevention

### Svelte 5 Runes
**File:** `svelte-runes.bench.svelte.ts`

Modern Svelte 5 runes vs Lattice slice patterns.

**Scenario:** Dashboard with business metrics calculations
- **Runes:** $derived with fine-grained access
- **Lattice:** Slice composition with $derived
- **Focus:** Realistic computation patterns

## 📈 Performance Optimization Tips

### For Accurate Results

1. **Use --expose-gc flag**
   ```bash
   node --expose-gc scripts/run-chunked-benchmarks.js real
   ```

2. **Run multiple iterations**
   ```bash
   # Run benchmark suite 3 times and average results
   for i in {1..3}; do pnpm bench:lattice; done
   ```

3. **Isolate system resources**
   - Close other applications
   - Use consistent Node.js versions
   - Avoid running during high system load

### Interpreting Variations

- **±10% variance:** Normal for JavaScript benchmarks
- **>25% variance:** May indicate inconsistent test conditions
- **Memory spikes:** Often due to garbage collection timing

## ⚖️ Benchmark Fairness

### Implementation Standards

1. **Realistic Usage Patterns**
   - Based on actual application scenarios
   - No artificial optimizations for any library
   - Comparable setup complexity

2. **Fair Comparisons**
   - Same computation workloads
   - Equivalent subscription patterns
   - Similar API complexity

3. **Measurement Accuracy**
   - Multiple benchmark runs
   - Memory isolation between tests
   - Cleanup verification

### What These Benchmarks Don't Cover

- **Developer Experience:** API ergonomics, TypeScript support
- **Ecosystem:** Plugin availability, community size  
- **Edge Cases:** Error handling, complex async patterns
- **Framework Integration:** SSR, hydration, dev tools

## 🔍 Analyzing Specific Results

### When Lattice Performs Well
- Complex state with fine-grained subscriptions
- Selective update patterns
- Composition-heavy architectures

### When Alternatives May Excel
- Simple state management needs
- Coarse-grained reactive patterns
- Minimal bundle size requirements

### Red Flags to Watch For
- **Memory leaks:** Growing memory without cleanup
- **Over-reactivity:** Computations > expected updates
- **Degradation:** Performance drops with scale

## 🚀 Contributing Benchmarks

1. **Focus on realistic scenarios** that users actually encounter
2. **Ensure fairness** across all implementations
3. **Document assumptions** and measurement methodology
4. **Test edge cases** where libraries might show different characteristics

See [Contributing Guidelines](../../CONTRIBUTING.md) for detailed standards.