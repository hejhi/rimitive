# Prompt: Implement Iterative Update System for Lattice Signals

## Context

You are refactoring a reactive signals library (Lattice) that has a performance bottleneck due to distributed recursion. The library currently uses mutual recursion across multiple functions when updating computed values, causing poor performance with deep dependency chains.

## Current Architecture Problem

The system has a recursive call cycle:
1. `computed.value` → `_update()` 
2. `_update()` → `shouldNodeUpdate()`
3. `shouldNodeUpdate()` → `checkNodeDirty()`
4. `checkNodeDirty()` → `source._update()` (recursion!)

This creates deep call stacks (40-120 frames) in benchmarks with nested computed values.

## Your Task

Create a unified iterative update system that eliminates all recursive calls while preserving the exact reactive behavior.

## Key Requirements

1. **Never call `_update()` recursively** - This is the most critical requirement
2. **Preserve exact behavior** - All existing tests must pass without modification
3. **Use a single iterative function** with an explicit stack/state machine
4. **Inline all update logic** instead of calling existing functions
5. **Handle all edge cases**: circular dependencies, disposed nodes, errors in computeds

## Implementation Guidelines

### 1. Create the Core Iterative Function

Create a new file `packages/signals/src/helpers/iterative-update.ts`:

```typescript
export function updateNodeIterative(
  node: ConsumerNode & { _flags?: number; _globalVersion?: number },
  ctx: SignalContext
): boolean {
  // Your implementation here
}
```

### 2. State Machine Design

Your stack frames should handle these phases:
- **check-flags**: Check if node needs updating (NOTIFIED, OUTDATED flags)
- **check-sources**: Iterate through source dependencies
- **update-computed**: For computed sources that need updating
- **recompute**: Execute the node's compute function
- **done**: Clean up and propagate results

### 3. Critical Logic to Inline

From `shouldNodeUpdate()` (dependency-tracking.ts:129-156):
- Check `OUTDATED` and `NOTIFIED` flags
- Update global version when clean

From `checkNodeDirty()` (dependency-tracking.ts:94-126):
- Compare source versions
- Update edge versions
- Check if sources changed

From `Computed._recompute()` (computed.ts:66-96):
- Set/clear `RUNNING` flag
- Execute callback with proper context
- Update value and version if changed
- Clean up sources

### 4. Integration

Modify `Computed._update()` (computed.ts:105-109) to use your iterative function:
```typescript
_update(): void {
  updateNodeIterative(this, ctx);
}
```

## Test Cases to Verify

1. **Deep chains**: 100+ levels of computed → computed → signal
2. **Wide graphs**: Single computed depending on 100+ sources
3. **Conditional dependencies**: Sources that are only accessed conditionally
4. **Circular dependencies**: Should detect and throw "Cycle detected"
5. **Disposed nodes**: Handle gracefully during traversal
6. **Errors in computeds**: Should propagate correctly

## Performance Targets

- Reduce call stack depth from 40-120 frames to ~1-5 frames
- Improve conditional dependency benchmark from 2.72x slower to within 1.5x of alien-signals
- No regression in other benchmarks

## Validation

Run these commands to verify your implementation:
```bash
# Run specific test suite
pnpm --filter @lattice/signals test iterative-traversal

# Run benchmarks
pnpm --filter @lattice/benchmarks bench:dev -- recursive-vs-iterative

# Run full test suite
pnpm --filter @lattice/signals test
```

## Common Pitfalls to Avoid

1. **Don't call any `_update()` method** - This restarts recursion
2. **Don't forget edge version updates** - Must happen even when sources are clean
3. **Don't skip global version updates** - Critical for performance
4. **Don't create new objects unnecessarily** - Reuse stack frames if possible
5. **Don't forget the RUNNING flag** - Prevents circular dependencies

## Success Criteria

Your implementation is successful when:
1. All tests in `iterative-traversal.test.ts` pass
2. The benchmark shows >40% performance improvement for deep chains
3. No regressions in other benchmarks
4. Memory usage is equal or better than recursive version