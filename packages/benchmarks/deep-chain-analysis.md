# Deep Chain Performance Analysis

## Benchmark Results
- **Lattice**: 183.47 µs/iter 
- **Preact**: 87.23 µs/iter (2.1x faster)
- **Alien**: 91.73 µs/iter (2.0x faster)

## What the Benchmark Does
1. Creates a chain of 50 computeds: `c1 = s + 1, c2 = c1 + 1, ..., c50 = c49 + 1`
2. Updates the source signal 100 times
3. Reads the final computed after each update

## Execution Path Analysis

### Lattice's Current Behavior:

When reading c50 after signal update:
1. c50 is INVALIDATED, calls `isStale()`
2. `isStale()` traverses to c49, which is also INVALIDATED
3. This continues recursively down to the source signal
4. On the way back up, each computed calls `_recompute()`

The key insight: `isStale()` uses a **depth-first traversal with a manual stack**, visiting each node exactly once. This is O(n) in terms of node visits.

### The Performance Gap

Looking at the code, the issue is NOT quadratic behavior as initially suspected. The traversal count test confirms Lattice visits each node exactly once.

The performance difference likely comes from:

1. **Stack Management Overhead**: `isStale()` uses a manual stack with object allocations:
   ```typescript
   stack = pushStack(stack, currentEdge.nextIn, currentNode, stale);
   ```
   Each push creates a new stack frame object.

2. **Two-Phase Process**: 
   - Phase 1: `isStale()` traverses to check staleness
   - Phase 2: `recompute()` actually computes values
   
   Alien combines these into one pass in `checkDirty()`.

3. **Edge Iteration**: Lattice iterates through edges even when there's only one dependency per computed in a linear chain.

## Alien's Optimization

Alien's `checkDirty()` function:
- Updates computeds during the staleness check
- Avoids separate recomputation phase
- Uses simpler stack management

## Potential Optimization

The `isStale()` function could be optimized to:
1. Update computeds during traversal (like Alien)
2. Use a simpler stack structure
3. Fast-path linear chains (single dependency case)