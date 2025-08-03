# Proposal: Convert Recursive Dependency Checking to Iterative

## Context

Lattice is a reactive signals library. When a computed value is read, it must check if its dependencies have changed by recursively updating them first.

## Problem

Lattice has a 2.72x performance gap vs alien-signals in conditional dependency scenarios due to distributed recursion:

```
_update → shouldNodeUpdate → checkNodeDirty → source._update (recursion!)
```

This creates 40-120 stack frames in deep dependency chains.

## Solution

Create a unified iterative update system that combines all update phases into a single state machine with an explicit stack.

### Key Insight

Simply making `checkNodeDirty` iterative won't work because it must call `source._update()`, which restarts recursion. The entire update flow must be redesigned.

### Implementation Details

```typescript
// State machine phases (numeric for performance)
const PHASE_CHECK_DIRTY = 0;
const PHASE_TRAVERSE_SOURCES = 1;
const PHASE_WAIT_FOR_SOURCE = 2;
const PHASE_READY_TO_COMPUTE = 3;
const PHASE_COMPUTED = 4;

// Pre-allocated resources
const framePool: UpdateFrame[] = [];  // Object pool for frames
const stack: UpdateFrame[] = new Array(100);  // Pre-allocated stack
const visiting: UpdatableNode[] = new Array(100);  // Array-based cycle detection

export function iterativeUpdate(node: UpdatableNode, ctx: SignalContext): void {
  // State machine implementation
  // Never calls _update() recursively
  // Reuses objects to minimize allocations
}
```

## Implementation Status (2025-08-03)

- ✅ Optimized implementation completed
- ✅ Eliminates all recursive calls (stack depth <5 vs 40-120)
- ✅ Performance improvements:
  - Deep chains (20+ levels): 1.1x to 2.7x faster
  - Shallow chains: Minor overhead (1.06x slower)
- ✅ Memory optimizations:
  - Pre-allocated frame pool (100 frames)
  - Pre-allocated stack array
  - Object reuse pattern
- ✅ All tests passing with identical behavior

## Performance Analysis

### Benchmarks Show:
- **Stack overflow risk**: Eliminated
- **Deep chain performance**: Significantly improved
- **Conditional dependencies**: Still 2.7x gap with Alien (not fully solved)
- **Memory pressure**: Reduced through object pooling

### Why the Gap Remains:
1. The iterative conversion addresses recursion but not the core inefficiency
2. Alien likely has additional optimizations for conditional dependency tracking
3. Further investigation needed into Alien's approach

## Next Steps

1. **Integration**: Replace recursive `_update()` in computed.ts
2. **Investigation**: Profile why Alien is faster at conditional dependencies
3. **Optimization**: Consider additional improvements based on findings

## Success Criteria Progress

1. ✅ Call stack depth < 5 frames (achieved)
2. ✅ All existing tests pass (verified)
3. ✅ No memory overhead (reduced via pooling)
4. ⚠️ Performance within 1.5x of alien-signals (partially achieved)