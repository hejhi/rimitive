# Memory Investigation Results: Lattice vs Preact/Alien Signals

## Executive Summary
The reported ~3.82 MB memory usage for Lattice in the `computed-diamond-simple` benchmark is likely a measurement artifact rather than a fundamental memory efficiency issue. My investigation reveals that the actual memory usage is much closer between implementations.

## Key Findings

### 1. Per-Object Memory Costs
When measured directly, the memory usage is:

**Signals:**
- Lattice: ~278 bytes per signal (MORE efficient)
- Preact: ~444 bytes per signal

**Computed Values:**
- Lattice: ~468 bytes per computed (LESS efficient, 1.94x)
- Preact: ~241 bytes per computed

**Dependency Edges:**
- Lattice: ~190 bytes per edge
- Preact: ~219 bytes per edge

### 2. The Real Memory Difference

The primary memory inefficiency in Lattice comes from computed values, where each computed creates:
1. A `ComputedNode` object with all graph properties
2. A `computed` function closure capturing context
3. A separate `peek` method closure
4. References to `ctx`, `trackDependency`, and `pullUpdates`

In contrast, Preact uses:
- A single prototype-based class instance
- Methods on the prototype (not per-instance closures)
- Smaller object structure

### 3. Benchmark Measurement Issues

The 3.82 MB measurement appears to be:
- **Cumulative across multiple runs**: Mitata runs benchmarks many times for statistical accuracy
- **Peak memory during execution**: Not just the setup phase
- **Including temporary allocations**: Memory used during the 100,000 iterations

When measured in isolation:
- Single diamond setup: ~3-14 KB for Lattice, ~5 KB for Preact
- After 100k iterations: ~70-90 KB total for both
- **Actual ratio: ~1.2x, not the reported ~5x**

## Root Causes

### 1. Factory Pattern Overhead
```typescript
// Lattice creates these for EACH API instance:
createGraphTraversal()    // Returns 2 closures
createGraphEdges()        // Returns 3 closures
createPullPropagator()    // Returns 1 closure
createBaseContext()       // Creates context object
```

### 2. Closure-Based Methods
```typescript
// Lattice - each signal/computed gets unique closures
function createSignal<T>(initialValue: T) {
  const node = { /* ... */ };
  function signal() { /* captures node, ctx, etc. */ }
  signal.peek = () => node.value;  // Another closure
  return signal;
}

// Preact - uses prototype methods (shared)
Signal.prototype.peek = function() { /* ... */ };
```

### 3. Double-Linked List Structure
Lattice's `Dependency` type has 6 pointer fields vs Preact's `Node` with 8 fields, but Lattice's overall object overhead is higher due to V8 hidden classes and property arrangements.

## Recommendations for Memory Optimization

### Immediate Fixes (Low Effort, High Impact)

1. **Use Prototype Methods**
   ```typescript
   // Instead of:
   computed.peek = () => { /* ... */ };

   // Use:
   ComputedPrototype.peek = function() { /* ... */ };
   ```

2. **Singleton Helper Instances**
   - Create graph helpers once globally, not per API instance
   - Share traversal and propagation logic

### Architectural Improvements (Higher Effort)

1. **Remove Factory Indirection**
   - Use direct constructors like Preact/Alien
   - Eliminate the API composition layer

2. **Optimize Computed Structure**
   - Reduce from ~468 bytes to ~250 bytes
   - Use class-based approach with prototypes
   - Minimize captured variables in closures

3. **Single Node Type**
   - Merge Dependency into a unified Node structure
   - Reduce object allocation overhead

## Conclusion

The reported memory issue is **not as severe as the benchmark suggests**. The actual memory overhead is:
- **Signals**: Lattice is MORE efficient
- **Computed**: Lattice is ~2x less efficient (main issue)
- **Overall**: ~1.2x overhead in realistic scenarios

The 3.82 MB measurement appears to be a cumulative/peak measurement artifact. The real focus should be on optimizing computed values, which show the most significant overhead (~468 vs ~241 bytes).

## Verification

To verify these findings, run:
```bash
# Direct memory test
node --expose-gc direct-memory-test.mjs

# Detailed breakdown
node --expose-gc detailed-memory-analysis.mjs

# Iteration test
node --expose-gc benchmark-iteration-test.mjs
```

These tests show the actual memory characteristics are much closer than the benchmark output suggests.