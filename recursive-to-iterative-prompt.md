# Prompt: Implement Iterative Dependency Checking for Lattice Signals

## Problem

Lattice has a performance bottleneck due to distributed recursion when updating computed values:

```
computed.value → _update() → shouldNodeUpdate() → checkNodeDirty() → source._update() → (recursion!)
```

This creates deep call stacks (40-120 frames) with nested dependencies.

### Key Files to Examine

1. `packages/signals/src/computed.ts` - See `_update()` method (line ~105)
2. `packages/signals/src/helpers/dependency-tracking.ts` - See `checkNodeDirty()` (line ~96)
3. `packages/benchmarks/src/suites/lattice/recursive-vs-iterative.bench.ts` - Performance test
4. `packages/signals/src/helpers/iterative-update.ts` - Existing proof of concept

## Solution

Create a unified iterative update system that eliminates all recursive calls while preserving exact reactive behavior.

## Key Requirements

1. **Never call `_update()` recursively** - Use explicit stack instead
2. **Preserve exact behavior** - All existing tests must pass
3. **Maintain encapsulation** - Use only Consumer/Producer interfaces
4. **Handle all edge cases** - Circular dependencies, disposed nodes, errors

## Implementation Approach

### State Machine Design

Create an iterative function with these phases:
- **check-dirty**: Examine flags (OUTDATED/NOTIFIED) to determine if update needed
- **traverse-sources**: Walk dependencies, checking versions
- **wait-for-source**: Pause while computed source updates
- **ready-to-compute**: All sources current, execute callback if needed
- **complete**: Update versions and clean up

### Critical Details

- Track visiting nodes in a Set for cycle detection
- Update edge versions even when sources are clean
- Preserve global version updates for performance
- Handle RUNNING flag to prevent circular dependencies
- Optimize allocations - reuse stack frames where possible

## Starting Point

A proof of concept exists in `packages/signals/src/helpers/iterative-update.ts` that:
- Works correctly but needs optimization for deep chains (30+ levels)
- Shows the state machine approach with explicit stack
- Has tests in `iterative-update-poc.test.ts`

## Next Steps

1. **Optimize the POC** - Focus on reducing allocations for deep chains
2. **Integrate with Computed** - Replace the recursive `_update()` call
3. **Run validation** - Ensure all tests pass and benchmarks improve

## Validation

```bash
# Run tests
pnpm --filter @lattice/signals test iterative-traversal

# Run benchmarks  
pnpm --filter @lattice/benchmarks bench:dev -- recursive-vs-iterative
```

## Success Criteria

1. All existing tests pass without modification
2. Call stack depth reduced from 40-120 frames to <5 frames
3. Performance within 1.5x of alien-signals for conditional dependencies
4. No memory leaks or increased allocations