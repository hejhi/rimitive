# Memory Accumulation Root Cause Analysis

## Executive Summary

Lattice shows significant memory accumulation in benchmarks (3.82 MB for diamond pattern, 11.37 MB for computed→effect) compared to Preact/Alien Signals. The root cause is **NOT** a memory leak in Lattice itself, but rather an interaction between:

1. How Lattice's factory-based API architecture works (instance-based context)
2. How the benchmarks are structured (API outside yield, nodes inside yield)
3. How mitata runs benchmarks (generator called once, yield function called thousands of times)

## The Exact Mechanism

### How Mitata Works
- The generator function is called **ONCE** per benchmark
- The yield function is called **THOUSANDS** of times (sample iterations)
- For 200 samples with default settings, yield runs ~100,000+ times

### The Problematic Pattern

```typescript
bench('Lattice', function* () {
  // Called ONCE - creates single API instance
  const api = createApi();
  const signal = api.signal;
  const computed = api.computed;

  yield () => {
    // Called THOUSANDS of times - creates new nodes each time
    const source = signal(0);
    const comp = computed(() => source() * 2);

    // Benchmark workload
    for (let i = 0; i < ITERATIONS; i++) {
      source(i);
      void comp();
    }
  };
});
```

### Why Memory Accumulates

1. **Single API Instance**: The API (with its context, graph helpers, scheduler) is created ONCE
2. **Multiple Node Sets**: New nodes are created on EVERY yield iteration (thousands of times)
3. **Shared Graph Management**: All nodes use the SAME:
   - `api._ctx` (GlobalContext)
   - `trackDependency` function
   - `propagate` function
   - Graph edge helpers
   - Scheduler (for effects)

4. **Cross-Iteration References**: Nodes from iteration N can form dependency edges with nodes from iteration N-1 because they share the same graph management system

5. **No Cleanup**: Disposers are never called in benchmarks, so nodes accumulate in the shared graph

## Why Preact/Alien Don't Have This Issue

### Different Architecture
```typescript
// Preact/Alien use GLOBAL state
let evalContext: Computed | Effect | undefined = undefined;
let batchedEffect: Effect | undefined = undefined;
let globalVersion = 0;

// Lattice uses INSTANCE-based state
const api = createApi(); // Contains context, helpers, etc.
```

### Correct Benchmark Pattern
```typescript
bench('Preact', function* () {
  // Nodes created OUTSIDE yield - only once
  const source = preactSignal(0);
  const comp = preactComputed(() => source.value * 2);

  yield () => {
    // Only workload runs here
    for (let i = 0; i < ITERATIONS; i++) {
      source.value = i;
    }
  };
});
```

## Memory Impact by Pattern

### Patterns with High Memory (Nodes read by other reactive nodes)
- **scaling-subscribers** (signal→computed→effect): 11.37 MB for 200 nodes
- **computed-diamond-simple** (diamond dependency): 3.82 MB

### Patterns with Low Memory (Nodes read synchronously)
- **scaling-computed** (signal→computed, no effects): Memory competitive
- **scaling-signal-effect** (signal→effect, no computed): Memory competitive

The difference: When computed nodes are read by effects or other computeds, they form persistent edges in the shared graph. When read only synchronously in the benchmark, they don't accumulate.

## Verification

Running the test suite confirms:
- Lattice with problematic pattern: 106,498 node sets created
- Preact with correct pattern: 1 node set created
- Lattice with fixed pattern (nodes outside yield): 1 node set created

## The Core Issue

This is **not a memory leak** in Lattice's reactive system. The issue is:

1. **Benchmarks misuse the API**: Creating API once but nodes many times violates the intended usage pattern
2. **Factory pattern assumption**: The factory pattern assumes nodes created through the same API instance are part of the same reactive system/application
3. **Mitata's execution model**: The generator/yield pattern doesn't match how real applications create reactive nodes

## Why This Matters

In real applications:
- Nodes are typically created once during component initialization
- The same nodes are reused across updates
- Disposal happens when components unmount
- This accumulation pattern doesn't occur

The benchmark issue only manifests because:
- Thousands of temporary nodes are created
- They all share the same API/context
- No cleanup occurs between iterations
- This is an artificial pattern not seen in real usage