# Recursive to Iterative Conversion TODO List

## Overview
Convert recursive dependency checking algorithms in Lattice Signals to iterative stack-based approach to improve performance in conditional dependency scenarios.

## Critical Architectural Issue

The recursion in Lattice is **distributed across multiple functions** creating a mutual recursion pattern:

```
computed.value → _update() → shouldNodeUpdate() → checkNodeDirty() → source._update() → (recurse)
```

This means we cannot simply make one function iterative - we must redesign the entire update flow.

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

## Phase 2: Architectural Redesign

### 2.1 Understand Current Architecture
- [ ] Document the complete recursive call chain with file:line references
- [ ] Identify all entry points to the update system
- [ ] Map out all state transitions during updates
- [ ] Understand the contract between _update(), shouldNodeUpdate(), and checkNodeDirty()

### 2.2 Design Unified Update System
- [ ] Create a single `updateNodeIterative()` function that handles the entire update process
- [ ] Define a unified stack frame that can represent all update phases:
  ```typescript
  interface UnifiedUpdateFrame {
    node: ConsumerNode;
    phase: 'check-flags' | 'check-sources' | 'recompute' | 'post-update';
    sourceEdge?: Edge;
    isDirty: boolean;
    oldVersion: number;
  }
  ```
- [ ] Design state machine for the iterative update process

### 2.3 Inline Update Logic
- [ ] Extract the logic from `shouldNodeUpdate()` to be inlined
- [ ] Extract the logic from `checkNodeDirty()` to be inlined
- [ ] Extract the recompute logic from `Computed._recompute()` to be inlined
- [ ] Ensure all flag manipulations happen in the correct order

## Phase 3: Implement Iterative Update System

### 3.1 Create Core Iterative Function
- [ ] Implement `updateNodeIterative()` in a new file `iterative-update.ts`
- [ ] Handle all phases of update in a single loop
- [ ] Maintain a visited set to prevent infinite loops
- [ ] Implement proper cleanup on early exit

### 3.2 Integration Points
- [ ] Modify `Computed._update()` to call `updateNodeIterative()`
- [ ] Ensure `Effect` nodes work with the new system
- [ ] Update `shouldNodeUpdate()` to detect and use iterative path
- [ ] Add feature flag to switch between recursive and iterative

### 3.3 Handle Edge Cases
- [ ] Test with circular dependencies
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
- Even in an iterative loop, calling `_update()` starts a new recursive chain
- The recursion is architectural, not just implementational
- The entire reactive system assumes these functions can call each other

### The Real Solution

We need a **unified iterative update system** that:
1. Never calls `_update()` recursively
2. Inlines all update logic into a single state machine
3. Manages the entire update process with an explicit stack

## Notes

- Cannot just convert one function - must redesign the entire update flow
- Use alien-signals as architectural reference, not implementation guide
- Preserve all reactive behaviors documented in tests
- Consider creating feature flag to switch between implementations during development
- The performance gain comes from eliminating function call overhead in deep chains