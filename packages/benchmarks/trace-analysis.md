# Lattice vs Alien-Signals Deep Chain Performance Analysis

## Key Difference Found

### Lattice's Execution Path (50 levels deep):

1. **Signal Update**: Marks all 50 computeds as INVALIDATED
2. **Reading Final Computed**: 
   - Calls `isStale()` which recursively traverses UP the chain
   - For each computed, it checks if dependencies are stale
   - This creates a deep recursive traversal through the stack
   - Each computed's `isStale()` check has to traverse to find VALUE_CHANGED on the signal

### The Problem:

In `isStale()` (dependency-graph.ts:154-239):
- When checking if c50 is stale, it traverses to c49
- When checking if c49 is stale, it traverses to c48
- ... continues all the way to the source signal
- This creates O(n²) behavior for deep chains

The traversal pattern:
```
c50 -> checks c49 -> checks c48 -> ... -> checks source (50 checks)
c49 -> checks c48 -> checks c47 -> ... -> checks source (49 checks)
c48 -> checks c47 -> checks c46 -> ... -> checks source (48 checks)
...
Total: 50 + 49 + 48 + ... + 1 = 1275 traversals
```

### Alien-Signals' Approach:

Alien uses `checkDirty()` which:
1. Traverses depth-first from the leaf
2. Updates computeds on the way back up
3. Each computed is checked/updated exactly once
4. Total traversals: 50 (linear)

## The Core Issue:

Lattice's `isStale()` doesn't cache the staleness check result. Each computed independently checks if its dependencies are stale, leading to redundant traversals.

In contrast, Alien-Signals' `checkDirty()` updates computeds during traversal, so each node is processed exactly once.

## Potential Solution:

The `isStale()` function should:
1. Cache staleness results during traversal
2. Or update computeds during the staleness check (like Alien does)
3. Or use a different algorithm that avoids redundant traversals