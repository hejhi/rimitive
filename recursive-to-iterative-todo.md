# Recursive to Iterative Conversion TODO List

## Overview
Convert the recursive dependency checking in Lattice Signals to an iterative implementation to improve performance in conditional dependency scenarios.

## Key Discovery
The initial approach of making `checkNodeDirty` iterative is insufficient. The recursion happens because `checkNodeDirty` calls `source._update()`, which creates a new recursive chain. The solution requires a unified iterative update system that manages the entire update process without recursive function calls.

## Critical Architectural Issue

The recursion in Lattice is **distributed across multiple functions** creating a mutual recursion pattern:

```
computed.value → _update() → shouldNodeUpdate() → checkNodeDirty() → source._update() → (recurse)
```

**Important Discovery**: Simply making `checkNodeDirty` iterative is insufficient because:
1. `checkNodeDirty` must ensure computed sources are up-to-date before checking versions
2. To update a computed source, it must call `source._update()` 
3. This starts a new recursive chain regardless of whether `checkNodeDirty` itself is iterative
4. The recursion is architectural, not just implementational

The solution requires a more fundamental change to how updates propagate through the dependency graph.

## Phase 1: Setup and Benchmarking

### 1.1 Create Performance Benchmark
- [x] Create new benchmark file: `packages/benchmarks/src/suites/lattice/recursive-vs-iterative.bench.ts`
- [x] Implement deep conditional dependency chain (10+ levels)
- [x] Add multiple branches where only one is active
- [x] Measure operations/second for read operations
- [ ] Capture baseline metrics (call stack depth, memory allocations)

### 1.2 Create Integration Test Suite
- [x] Create test file: `packages/signals/src/helpers/iterative-traversal.test.ts`
- [x] Copy all relevant tests from graph-traversal.test.ts
- [x] Add tests for deep chains (100+ levels)
- [x] Add tests for wide graphs (many siblings)
- [x] Add tests for mixed conditional/unconditional dependencies

## Phase 2: Implement Iterative Update System

### 2.1 Understand Current Implementation
- [x] Document the recursive call chain with file:line references
- [x] Identify how checkNodeDirty triggers recursion  
- [x] Map out version checking and edge update logic
- [x] Understand Consumer/Producer interface usage
- [x] Discovered: Simple iterative checkNodeDirty won't work - need unified approach

### 2.2 Design Iterative Algorithm  
- [x] Identified need for unified update system (not just iterative checkNodeDirty)
- [ ] Design state machine that combines all update phases:
  ```typescript
  interface UpdateFrame {
    node: ConsumerNode & { _globalVersion?: number };
    phase: 'initial' | 'check-sources' | 'awaiting-source' | 'sources-checked' | 'complete';
    currentSource?: Edge;
    isDirty: boolean;
    // Track which computed source we're waiting for
    pendingSource?: ConsumerNode & ProducerNode & { _update(): void };
  }
  ```
- [ ] Key insight: Must process dependency graph in correct order:
  1. Start from requested node
  2. Traverse down to leaf nodes (signals)  
  3. Process back up, ensuring sources update before consumers
- [ ] Handle flag transitions correctly:
  - NOTIFIED → check if dirty → OUTDATED if dirty
  - OUTDATED → must recompute
  - Clear flags after recomputation
- [ ] Maintain circular dependency detection

### 2.3 Implement Iterative Version
- [ ] Create new unified iterative update function that:
  - Never calls `_update()` recursively
  - Manages entire update process with explicit stack
  - Inlines shouldNodeUpdate and checkNodeDirty logic
  - Calls _recompute() at appropriate times
- [ ] Integrate with existing Computed class
- [ ] Maintain all reactive behaviors from tests
- [ ] Preserve encapsulation - use only public interfaces

## Phase 3: Integration and Edge Cases

### 3.1 Integration
- [ ] Ensure `shouldNodeUpdate` continues to work correctly
- [ ] Verify computed values update properly
- [ ] Test with effects and other consumers

### 3.2 Handle Edge Cases
- [ ] Test with circular dependencies (should throw "Cycle detected")
- [ ] Test with disposed nodes during traversal
- [ ] Test with errors during source updates
- [ ] Verify version tracking remains correct

## Phase 4: Performance Optimization

### 4.1 Stack Optimization
- [ ] Minimize stack frame allocations
- [ ] Use bit flags for state instead of objects where possible
- [ ] Optimize hot paths with inline conditions
- [ ] Consider using fixed-size array for small stacks

### 4.2 Cache Optimization
- [ ] Preserve _lastEdge optimization
- [ ] Add fast path for single-source nodes
- [ ] Cache frequently accessed node properties
- [ ] Minimize property access in hot loops

## Phase 5: Testing and Validation

### 5.1 Run Existing Test Suite
- [ ] Ensure all computed.test.ts tests pass
- [ ] Ensure all effect.test.ts tests pass
- [ ] Ensure all dependency-tracking.test.ts tests pass
- [ ] Ensure all graph-traversal.test.ts tests pass

### 5.2 Performance Validation
- [ ] Run new benchmark and compare to baseline
- [ ] Verify 2.72x gap reduced to under 1.5x
- [ ] Check no regression in other benchmarks
- [ ] Profile with Chrome DevTools for call stack depth

### 5.3 Memory Validation
- [ ] Measure memory allocations per operation
- [ ] Verify no memory leaks with long-running tests
- [ ] Check stack frame pool effectiveness
- [ ] Compare heap snapshots before/after

## Phase 6: Integration and Cleanup

### 6.1 Replace Recursive Implementation
- [ ] Switch all callers to use iterative versions
- [ ] Remove or deprecate recursive functions
- [ ] Update any documentation/comments
- [ ] Clean up any temporary code

### 6.2 Code Review Checklist
- [ ] No new `any` types introduced
- [ ] All functions under 20 lines
- [ ] Cyclomatic complexity < 5
- [ ] Clear variable/function names
- [ ] No commented-out code

### 6.3 Final Validation
- [ ] Run full test suite with coverage
- [ ] Run all benchmarks to verify no regressions
- [ ] Test with real-world usage patterns
- [ ] Document any behavioral differences

## Success Criteria

1. **Performance**: Conditional dependency benchmark gap reduced from 2.72x to under 1.5x
2. **Correctness**: All existing tests pass without modification
3. **No Regressions**: Other benchmarks maintain current performance
4. **Memory**: No increase in memory usage vs recursive approach
5. **Maintainability**: Code remains readable and debuggable

## Key Insights

### The Distributed Recursion Problem

The recursive pattern spans multiple files and functions:

1. **computed.ts:57** - `get value()` calls `this._update()`
2. **computed.ts:106** - `_update()` calls `shouldNodeUpdate(this, ctx)`
3. **dependency-tracking.ts:146** - `shouldNodeUpdate()` calls `checkNodeDirty(node, ctx)`
4. **dependency-tracking.ts:122** - `checkNodeDirty()` calls `sourceNode._update()` (RECURSION!)

This creates the cycle: `_update → shouldNodeUpdate → checkNodeDirty → _update`

### Why Naive Iterative Conversion Fails

Simply making `checkNodeDirty` iterative doesn't work because:
- `checkNodeDirty` must ensure computed sources are up-to-date by calling `source._update()`
- Even if `checkNodeDirty` uses an iterative loop, calling `_update()` starts a new recursive chain
- The recursion is architectural - it's built into how updates propagate through the graph

### The Real Solution

We need a **unified iterative update system** that:
1. Never calls `_update()` recursively (breaks the recursive chain)
2. Combines all update phases into a single state machine
3. Manages source traversal, version checking, and recomputation with an explicit stack
4. Maintains the exact same reactive behavior as the recursive version

## Notes

- Cannot just convert one function - must redesign the entire update flow
- Use alien-signals as architectural reference, not implementation guide
- Preserve all reactive behaviors documented in tests
- Consider creating feature flag to switch between implementations during development
- The performance gain comes from eliminating function call overhead in deep chains