# Deep Chain Performance Analysis - Complete Investigation

## Performance Issue
**Benchmark**: `computed-chain-very-deep.bench.ts`
- Creates a chain of 50 computeds where each depends on the previous one
- **Lattice**: 183.47 µs/iter 
- **Preact**: 87.23 µs/iter (2.1x faster)
- **Alien**: 91.73 µs/iter (2.0x faster)

## Root Cause Identified

### The Problem
When reading the final computed (c50) after a signal update, Lattice exhibits redundant `isStale()` calls throughout the chain.

### Execution Flow in Lattice

1. **Signal Update Phase** (`packages/signals/src/signal.ts:86`)
   - Signal marks all 50 dependent computeds as INVALIDATED via `invalidate()`
   
2. **Read Phase - The Inefficiency**
   - User reads c50
   - c50's read path (`packages/signals/src/computed.ts:129`) calls `update()` 
   - `update()` checks INVALIDATED flag (`packages/signals/src/computed.ts:108-114`):
     ```typescript
     else if (state._flags & INVALIDATED) {
       if (isStale(state)) recompute();
       else state._flags = state._flags & ~INVALIDATED;
     }
     ```
   - c50 calls `isStale()` (`packages/signals/src/helpers/dependency-graph.ts:154`)
   - `isStale()` traverses down to c49, c48, ... to the source signal
   - During traversal, it updates each computed (`dependency-graph.ts:240`):
     ```typescript
     if (stale && isDerived(currentNode)) stale = currentNode._recompute();
     ```
   - **BUT**: When c49's `_recompute()` runs, it reads c48
   - This read goes through c48's normal read path, which ALSO checks INVALIDATED and calls `isStale()`
   - This pattern repeats for every computed in the chain

### The Key Insight
Each computed independently calls `isStale()` when read, even though they're already being updated as part of the parent's `isStale()` traversal. This creates redundant work:
- c50's `isStale()` traverses and updates the entire chain
- But c49, c48, etc. each call `isStale()` again when their dependencies read them

## How Alien-Signals Avoids This

In Alien (`reference-packages/alien-signals/src/system.ts:195-262`):
- `checkDirty()` is called once from the top-level read
- It traverses and updates the entire chain in one pass
- Intermediate computeds don't independently check staleness during the traversal
- Uses a clever optimization for linear chains (line 215-217):
  ```typescript
  if (link.nextSub !== undefined || link.prevSub !== undefined) {
    stack = { value: link, prev: stack };
  }
  ```
  Only pushes to stack when there are multiple paths (avoids allocations for linear chains)

## Failed Optimization Attempt

### What Was Tried
Added linear chain detection to avoid stack allocations (`dependency-graph.ts:212-227`):
```typescript
const hasMoreEdges = currentEdge.nextIn !== undefined;
if (hasMoreEdges) {
  stack = pushStack(stack, currentEdge.nextIn, currentNode, stale);
  stackPushCount++;
} else {
  linearChainNodes[linearChainDepth++] = currentNode;
  linearOptCount++;
}
```

### Why It Didn't Help
The optimization addressed stack allocations, but that wasn't the bottleneck. The real issue is the redundant `isStale()` calls at a higher architectural level.

## Potential Solutions

### Option 1: Track Traversal Context
Check if we're already in an `isStale()` traversal before calling it again:
- Add a flag to context indicating "already checking staleness"
- Skip `isStale()` call in `update()` if this flag is set

### Option 2: Clear INVALIDATED During Traversal
When `isStale()` updates a computed, immediately clear its INVALIDATED flag so subsequent reads don't check staleness again.

### Option 3: Architectural Change
Restructure how staleness checking works to be more like Alien-Signals - single top-down traversal that updates all computeds without triggering their individual staleness checks.

## Key Files and Functions

- **Signal update**: `packages/signals/src/signal.ts:86` - `invalidate()` call
- **Computed read**: `packages/signals/src/computed.ts:117-132` - main read function
- **Update logic**: `packages/signals/src/computed.ts:103-115` - `update()` function
- **Staleness check**: `packages/signals/src/helpers/dependency-graph.ts:154-256` - `isStale()` function
- **Recompute during traversal**: `packages/signals/src/helpers/dependency-graph.ts:240`
- **Alien's approach**: `reference-packages/alien-signals/src/system.ts:195-262` - `checkDirty()`

## Conclusion

The 2.1x performance gap on deep chains is caused by redundant `isStale()` calls, not quadratic traversal as initially suspected. Each computed in the chain independently checks staleness even when already being updated by a parent's traversal. The fix requires preventing these redundant checks, likely by tracking traversal context.