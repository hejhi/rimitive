# Benchmark Best Practices

This document outlines the best practices we follow for our mitata benchmarks, based on the official recommendations and our implementation improvements.

## Key Improvements Made

### 1. Dead Code Elimination (DCE) Prevention
- **Problem**: Compilers may optimize away unused computations
- **Solution**: 
  - Return accumulated values from benchmark functions
  - Use computed results in meaningful ways
  - Example: `return sum;` instead of `void value;`

### 2. Garbage Collection Control
- **Problem**: GC can cause inconsistent timing
- **Solution**:
  - Add `.gc('inner')` for GC between iterations within same configuration
  - Add `.gc('outer')` for GC between different parameter configurations
  - Run benchmarks with `--expose-gc` flag

### 3. Warm-up Phases
- **Problem**: Cold code paths can skew initial measurements
- **Solution**:
  - Execute setup operations before `yield`
  - Warm up dependency chains to establish connections
  - Example: `source.value = 1; void computed.value;` before yield

### 4. Parameter Exploration
- **Problem**: Limited test cases may miss performance characteristics
- **Solution**:
  - Use `.range()` for continuous parameter exploration
  - Use `.args()` for discrete test cases
  - Test multiple parameter combinations

### 5. Computed Properties
- **Problem**: Redundant setup code in benchmarks
- **Solution**:
  - Use computed properties `[0]()` to generate unique data per iteration
  - Prevents shared state between iterations
  - Example: `[0]() { return Array.from({ length: n }, (_, i) => i); }`

### 6. Concurrency Testing
- **Problem**: Real-world apps have concurrent updates
- **Solution**:
  - Add async benchmarks with `concurrency` parameter
  - Test Promise.all() patterns
  - Measure contention and synchronization overhead

### 7. Memory Pressure Testing
- **Problem**: Memory characteristics affect real-world performance
- **Solution**:
  - Test object creation/disposal patterns
  - Measure with varying object counts
  - Include cleanup in measurements

## Running Benchmarks

```bash
# With garbage collection control
node --expose-gc src/suites/lattice/signals.bench.ts

# With hardware counters (if available)
node --expose-gc --perf-basic-prof src/suites/lattice/signals.bench.ts
```

## Benchmark Structure

```typescript
bench('Library - operation: $param', function* (state) {
  const param = state.get('param');
  
  // Setup phase (not measured)
  const signal = createSignal(0);
  
  // Warm-up
  signal.value = 1;
  
  yield () => {
    // Measured phase
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      signal.value = i;
      result += signal.value;
    }
    return result; // Prevent DCE
  };
})
.args('param', [10, 100, 1000])
.gc('inner'); // Control GC
```

## Tips for Writing New Benchmarks

1. **Always return values** to prevent dead code elimination
2. **Isolate setup from measurement** using generator functions
3. **Add warm-up phases** for dependency-heavy benchmarks
4. **Use appropriate GC modes** based on memory allocation patterns
5. **Test edge cases** with parameter ranges
6. **Include cleanup** in benchmarks that allocate resources
7. **Document intent** clearly in benchmark names and comments

## Avoiding Common Pitfalls

- ❌ Don't use `void` alone - accumulate and return values
- ❌ Don't mix setup with measurement - use generator `yield`
- ❌ Don't forget warm-up for computed chains
- ❌ Don't ignore GC impact - use `.gc()` appropriately
- ❌ Don't test only one parameter value - use ranges or multiple args
- ✅ Do return meaningful values from benchmarks
- ✅ Do separate setup from measurement
- ✅ Do warm up dependency chains
- ✅ Do control garbage collection
- ✅ Do test multiple parameter values