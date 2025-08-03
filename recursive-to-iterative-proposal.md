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

### Design

```typescript
const iterativeUpdate = (node: UpdatableNode, ctx: SignalContext): void => {
  // State machine with explicit stack
  // Phases: check-dirty → traverse-sources → wait-for-source → ready-to-compute → complete
  // Never calls _update() recursively
}
```

## Implementation Status

- ✅ Proof of concept created and tested
- ✅ Eliminates all recursive calls
- ✅ 2x faster for shallow chains (10-20 levels)
- ⏳ Needs optimization for deep chains (30+ levels)
- ⏳ Production integration pending

## Success Criteria

1. Performance within 1.5x of alien-signals
2. All existing tests pass
3. No memory overhead
4. Call stack depth < 5 frames (vs current 40-120)