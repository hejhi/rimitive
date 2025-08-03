# Recursive to Iterative Conversion TODO List

## Overview
Convert recursive dependency checking algorithms in Lattice Signals to iterative stack-based approach to improve performance in conditional dependency scenarios.

## Phase 1: Setup and Benchmarking

### 1.1 Create Performance Benchmark
- [ ] Create new benchmark file: `packages/benchmarks/test-recursive-vs-iterative.js`
- [ ] Implement deep conditional dependency chain (10+ levels)
- [ ] Add multiple branches where only one is active
- [ ] Measure operations/second for read operations
- [ ] Capture baseline metrics (call stack depth, memory allocations)

### 1.2 Create Integration Test Suite
- [ ] Create test file: `packages/signals/src/helpers/iterative-traversal.test.ts`
- [ ] Copy all relevant tests from graph-traversal.test.ts
- [ ] Add tests for deep chains (100+ levels)
- [ ] Add tests for wide graphs (many siblings)
- [ ] Add tests for mixed conditional/unconditional dependencies

## Phase 2: Implement Stack Data Structures

### 2.1 Define Stack Frame Types
- [ ] Create interface for `DirtyCheckFrame` in types.ts
- [ ] Add fields: node, sourceIndex, sourcesCount, result
- [ ] Create interface for `UpdateCheckFrame`
- [ ] Add fields: node, phase (checking/updating), result

### 2.2 Implement Stack Pool
- [ ] Create stack frame pool similar to edge pool
- [ ] Implement `acquireFrame()` and `releaseFrame()` functions
- [ ] Add frame reuse optimization
- [ ] Test memory allocation reduction

## Phase 3: Convert checkNodeDirty Function

### 3.1 Create Iterative Version
- [ ] Create new function `checkNodeDirtyIterative()` in dependency-tracking.ts
- [ ] Implement explicit stack using linked list pattern
- [ ] Convert recursive `source._update()` calls to stack pushes
- [ ] Handle early returns with state flags

### 3.2 Preserve Behavior
- [ ] Maintain depth-first traversal order
- [ ] Preserve version update timing
- [ ] Handle DISPOSED and RUNNING flags correctly
- [ ] Maintain source traversal order (first to last)

### 3.3 Handle Edge Cases
- [ ] Test with circular dependencies
- [ ] Test with disposed nodes during traversal
- [ ] Test with errors during source updates
- [ ] Verify version tracking remains correct

## Phase 4: Convert shouldNodeUpdate Function

### 4.1 Break Recursion Cycle
- [ ] Modify shouldNodeUpdate to use iterative checkNodeDirty
- [ ] Remove recursive call path through _update()
- [ ] Ensure flag updates happen at correct times
- [ ] Preserve NOTIFIED to OUTDATED transition logic

### 4.2 Update Computed._update()
- [ ] Modify to work with iterative approach
- [ ] Ensure version updates happen correctly
- [ ] Maintain lazy evaluation semantics
- [ ] Test with nested computed dependencies

## Phase 5: Performance Optimization

### 5.1 Stack Optimization
- [ ] Minimize stack frame allocations
- [ ] Use bit flags for state instead of objects where possible
- [ ] Optimize hot paths with inline conditions
- [ ] Consider using fixed-size array for small stacks

### 5.2 Cache Optimization
- [ ] Preserve _lastEdge optimization
- [ ] Add fast path for single-source nodes
- [ ] Cache frequently accessed node properties
- [ ] Minimize property access in hot loops

## Phase 6: Testing and Validation

### 6.1 Run Existing Test Suite
- [ ] Ensure all computed.test.ts tests pass
- [ ] Ensure all effect.test.ts tests pass
- [ ] Ensure all dependency-tracking.test.ts tests pass
- [ ] Ensure all graph-traversal.test.ts tests pass

### 6.2 Performance Validation
- [ ] Run new benchmark and compare to baseline
- [ ] Verify 2.72x gap reduced to under 1.5x
- [ ] Check no regression in other benchmarks
- [ ] Profile with Chrome DevTools for call stack depth

### 6.3 Memory Validation
- [ ] Measure memory allocations per operation
- [ ] Verify no memory leaks with long-running tests
- [ ] Check stack frame pool effectiveness
- [ ] Compare heap snapshots before/after

## Phase 7: Integration and Cleanup

### 7.1 Replace Recursive Implementation
- [ ] Switch all callers to use iterative versions
- [ ] Remove or deprecate recursive functions
- [ ] Update any documentation/comments
- [ ] Clean up any temporary code

### 7.2 Code Review Checklist
- [ ] No new `any` types introduced
- [ ] All functions under 20 lines
- [ ] Cyclomatic complexity < 5
- [ ] Clear variable/function names
- [ ] No commented-out code

### 7.3 Final Validation
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

## Notes

- Start with checkNodeDirty as it's the primary bottleneck
- Use alien-signals as reference but adapt to Lattice's architecture
- Preserve all reactive behaviors documented in tests
- Consider creating feature flag to switch between implementations during development