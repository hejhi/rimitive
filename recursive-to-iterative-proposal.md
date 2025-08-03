# Proposal: Convert Recursive Dependency Checking to Iterative in Lattice Signals

## Executive Summary

Convert the recursive `checkNodeDirty` function in Lattice to an iterative implementation to improve performance in conditional dependency scenarios where alien-signals currently outperforms Lattice by 2.72x.

## The Distributed Recursion Problem

The performance bottleneck is a **distributed mutual recursion** across multiple files:

### Recursive Call Chain

1. **Entry Point**: `packages/signals/src/computed.ts:48-58` - `get value()`
   ```typescript
   get value(): T {
     // ...
     this._update();  // Starts the chain
     return this._value!;
   }
   ```

2. **First Call**: `packages/signals/src/computed.ts:105-109` - `_update()`
   ```typescript
   _update(): void {
     if (shouldNodeUpdate(this, ctx)) {  // Delegates to helper
       this._recompute();
     }
   }
   ```

3. **Second Call**: `packages/signals/src/helpers/dependency-tracking.ts:146` - `shouldNodeUpdate()`
   ```typescript
   if (checkNodeDirty(node, ctx)) {  // Checks all dependencies
     node._flags |= OUTDATED;
     return true;
   }
   ```

4. **The Recursion**: `packages/signals/src/helpers/dependency-tracking.ts:109-116` - `checkNodeDirty()`
   ```typescript
   if ('_update' in sourceNode && ...) {
     const oldVersion = sourceNode._version;
     (sourceNode as unknown as {_update(): void})._update();  // RECURSION!
     if (oldVersion !== sourceNode._version) return true;
   }
   ```

This creates the cycle: **`_update → shouldNodeUpdate → checkNodeDirty → source._update`**

### Recursion Depth in Benchmarks

In the conditional dependency benchmark:
- `condResult` → `condExpensiveA` → `condA` (3 levels)
- With 10 levels: 10 stack frames × 4 function calls = 40 frames
- With 30 levels: 30 stack frames × 4 function calls = 120 frames

Each level creates multiple stack frames with associated overhead.

## Proposed Solution

### Create Unified Iterative Update System

The core insight: We cannot just make `checkNodeDirty` iterative because it must call `source._update()`, which restarts the recursion. Instead, we need a unified iterative update system:

```typescript
const iterativeUpdate = (
  node: ConsumerNode & ProducerNode & { _globalVersion?: number; _flags: number },
  ctx: SignalContext
): void => {
  // Single iterative function that handles entire update process
  // Combines logic from _update(), shouldNodeUpdate(), and checkNodeDirty()
  // Uses explicit stack to manage all phases of update
  // Never calls _update() recursively
}
```

### Key Design Principles

1. **Maintain Encapsulation**: The solution uses only Consumer/Producer interfaces, no extension-specific knowledge
2. **Preserve Behavior**: All existing tests pass without modification
3. **Detect Cycles**: Track visiting nodes to throw "Cycle detected" on circular dependencies
4. **Same Interface**: Function signature and return type remain unchanged

## Implementation Plan

### Phase 1: Setup (Complete)
- ✅ Benchmark created: `packages/benchmarks/src/suites/lattice/recursive-vs-iterative.bench.ts`
- ✅ Test suite created: `packages/signals/src/helpers/iterative-traversal.test.ts`

### Phase 2: Implementation (In Progress)
1. ✅ Created proof of concept `iterativeUpdate` function in `iterative-update.ts`
2. ✅ Implemented state machine with phases:
   - `check-dirty`: Check if node needs update based on flags
   - `traverse-sources`: Walk through source dependencies
   - `wait-for-source`: Handle computed sources that need updating first
   - `ready-to-compute`: All sources updated, ready to recompute
   - `computed`: Cleanup and pop from stack
3. ✅ Added visited tracking Set for circular dependency detection
4. ✅ Verified correctness with comprehensive tests
5. ⏳ Performance optimization needed - currently faster for shallow chains but needs work for deep chains
6. ⏳ Integration with existing `Computed` class pending

### Phase 3: Validation
1. Ensure all tests pass
2. Run benchmarks to verify performance improvement
3. Profile to confirm reduced call stack depth

## Current Results

### Proof of Concept Performance
- Successfully eliminated recursive calls using explicit stack
- Performance results from micro-benchmark:
  - 10-level chains: 2.2x faster
  - 20-level chains: 1.8x faster  
  - 30+ level chains: Currently slower (needs optimization)
- Maintains all reactive behaviors correctly

### Remaining Work
- Optimize stack frame allocations
- Reduce overhead for deep chains
- Integrate with production code
- Target: Within 1.5x of alien-signals performance in all scenarios

## Success Criteria

1. **Performance**: Reduce gap from 2.72x to under 1.5x in conditional dependency benchmark
2. **Correctness**: All existing tests pass without modification
3. **No Regressions**: Other benchmarks maintain current performance
4. **Memory**: No increase in memory usage

## Technical Notes

- The key insight is that we cannot convert individual functions - we must redesign the entire update flow
- The performance gain comes from eliminating function call overhead in deep dependency chains
- This matches the architectural pattern used by alien-signals (single iterative update function)

## References

- Current bottleneck: `packages/signals/src/helpers/dependency-tracking.ts:109-116`
- Benchmark: `packages/benchmarks/src/suites/lattice/recursive-vs-iterative.bench.ts`
- Test suite: `packages/signals/src/helpers/iterative-traversal.test.ts`