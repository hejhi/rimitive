# Problem: Recursive Dependency Updates in Lattice Signals

## Background

Lattice is a reactive signals library where computed values must check if their dependencies have changed before recomputing. This currently uses recursion.

## The Problem

When accessing a computed value, the update chain triggers deep recursion:

```
computed.value → _update() → shouldNodeUpdate() → checkNodeDirty() → source._update() → (recursion!)
```

### Why This Matters

1. **Stack overflow risk**: Deep dependency chains (40-120 frames) can exceed stack limits
2. **Performance overhead**: Function call overhead accumulates with each recursive call
3. **Memory pressure**: Each stack frame consumes memory
4. **Debugging difficulty**: Deep stack traces are hard to debug

## Key Code Locations

1. `packages/signals/src/computed.ts` - The `_update()` method (line ~105) contains the recursive logic
2. `packages/signals/src/helpers/dependency-tracking.ts` - The `checkNodeDirty()` function (line ~96) triggers recursive updates
3. `packages/benchmarks/src/suites/lattice/recursive-vs-iterative.bench.ts` - Benchmarks comparing approaches

## Performance Context

### Current Performance Gap
- Lattice is 2.72x slower than alien-signals library in conditional dependency scenarios
- The recursive implementation contributes to this gap but isn't the only factor

### Conditional Dependencies Explained
Conditional dependencies occur when a computed value only accesses some of its potential dependencies based on runtime conditions:

```javascript
// Example: This computed only reads 'expensiveB' if 'condition' is false
computed(() => condition.value ? cheapA.value : expensiveB.value)
```

The challenge: Avoid unnecessary updates when unused branches change.

## Solution Requirements

### Must Have
1. **Eliminate recursion**: Convert to iterative approach with explicit stack
2. **Preserve behavior**: Exact same reactive semantics as current implementation
3. **Maintain performance**: No regression for simple dependency chains
4. **Handle edge cases**: Circular dependencies, deep chains, wide graphs

### Success Metrics
1. Stack depth < 5 frames (vs current 40-120)
2. All existing tests pass unchanged
3. Performance within 1.5x of alien-signals (stretch goal)
4. No increase in memory usage

## Technical Constraints

- Cannot change the public API of signals/computed
- Must work with existing TypeScript strict mode settings
- Should integrate cleanly with current helper structure
- Must support all current edge cases (cycles, etc.)