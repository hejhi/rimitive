# Performance Solution for Deep Chains

## Root Cause
Lattice is 2.1x slower than Alien-Signals on deep linear chains due to **unnecessary stack allocations**.

## The Problem
In `isStale()` (dependency-graph.ts), for every level in the chain, Lattice:
1. Calls `pushStack()` which allocates a new object
2. For a 50-level chain, that's 50 object allocations
3. These allocations happen on every update

## Alien's Optimization
Alien-Signals uses a clever optimization in `checkDirty()`:
```typescript
// Only push to stack if there are multiple paths to explore
if (link.nextSub !== undefined || link.prevSub !== undefined) {
    stack = { value: link, prev: stack };
}
```

For linear chains (where each node has only one subscriber), it:
- Never pushes to the stack
- Just uses a simple `checkDepth` counter
- Avoids all object allocations

## The Fix
Modify `isStale()` to detect linear chains and avoid stack allocations:

```typescript
// Before traversing into a dependency
const hasMultipleEdges = currentEdge.nextIn !== undefined;

if (hasMultipleEdges) {
    // Multiple dependencies - need stack to remember position
    stack = pushStack(stack, currentEdge.nextIn, currentNode, stale);
} else {
    // Linear chain - no need for stack, just increment depth
    checkDepth++;
}
```

## Expected Impact
- Should bring Lattice's performance on par with Alien-Signals for deep chains
- Reduces memory pressure from repeated allocations
- Maintains correctness for complex dependency graphs

## Why This Matters
Deep linear chains are common in:
- Derived state calculations
- Data transformation pipelines
- Computed value chains in UI frameworks

This optimization would make Lattice competitive on these workloads.