# Proposal: Convert Recursive Algorithms to Iterative in Lattice Signals

## Executive Summary

Convert the distributed recursive dependency checking algorithm in Lattice to an iterative stack-based approach to improve performance in conditional dependency scenarios where alien-signals currently outperforms Lattice by 2.72x.

## The Distributed Recursion Problem

The performance bottleneck is not a simple recursive function, but a **distributed mutual recursion** across multiple files:

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

## Why Current Approach Fails

Our attempted iterative conversion of `checkNodeDirty` (lines 102-211) fails because:

1. It still calls `computedNode._update()` at line 177
2. This `_update()` call starts a new recursive chain
3. The recursion is **architectural**, not just implementational

## Proposed Solution

### 1. Create Unified Iterative Update System

Create a new function that handles the entire update process without recursive calls:

**File**: `packages/signals/src/helpers/iterative-update.ts`

```typescript
interface UnifiedUpdateFrame {
  node: ConsumerNode & { _flags?: number; _globalVersion?: number };
  phase: 'check-flags' | 'check-sources' | 'recompute' | 'done';
  sourceEdge?: Edge;
  isDirty: boolean;
  sourcesProcessed: number;
}

export function updateNodeIterative(
  node: ConsumerNode & { _flags?: number; _globalVersion?: number },
  ctx: SignalContext
): boolean {
  // Single iterative loop handling all update phases
  // Never calls _update() recursively
}
```

### 2. Inline All Update Logic

Instead of calling separate functions, inline their logic:
- Flag checking from `shouldNodeUpdate()` (lines 129-156)
- Source checking from `checkNodeDirty()` (lines 94-126)
- Recomputation from `Computed._recompute()` (lines 66-96)

### 3. Integration Points

Modify existing code to use the iterative system:
- `Computed._update()` at line 105 calls `updateNodeIterative()` instead
- Add feature flag for gradual rollout
- Preserve existing API surface

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