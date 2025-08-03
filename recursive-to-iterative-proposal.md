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

### Make checkNodeDirty Iterative

Replace the recursive implementation of `checkNodeDirty` with an iterative version that uses an explicit stack:

```typescript
const checkNodeDirty = (
  node: ConsumerNode & { _globalVersion?: number },
  ctx: SignalContext
): boolean => {
  // Use stack-based iteration instead of recursion
  // Track nodes being updated to detect cycles
  // Preserve all existing behavior
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

### Phase 2: Implementation (Next)
1. Create `iterative-update.ts` with unified update function
2. Implement state machine for all update phases
3. Add visited tracking to prevent infinite loops
4. Integrate with existing `Computed` class

### Phase 3: Validation
1. Ensure all tests pass
2. Run benchmarks to verify performance improvement
3. Profile to confirm reduced call stack depth

## Expected Results

### Before Optimization
- Deep recursive call stacks (40-120 frames for benchmarks)
- Higher memory allocation due to stack frames
- 2.72x slower than alien-signals in conditional scenarios

### After Optimization
- Flat call stacks (single iterative function)
- Reduced memory allocation
- Target: Within 1.5x of alien-signals performance

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