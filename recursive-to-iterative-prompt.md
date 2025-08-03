# Prompt: Implement Iterative Dependency Checking for Lattice Signals

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

Create an iterative update system that eliminates the recursive call chain while preserving exact reactive behavior and maintaining encapsulation between extensions. This requires more than just making `checkNodeDirty` iterative - it requires a unified approach to the entire update process.

## Key Requirements

1. **Never call `_update()` recursively** - This is the most critical requirement
2. **Preserve exact behavior** - All existing tests must pass without modification
3. **Maintain encapsulation** - The solution must not have any extension-specific knowledge
4. **Use Consumer/Producer interfaces** - These are the shared contracts between extensions
5. **Handle all edge cases**: circular dependencies, disposed nodes, errors in computeds

## Implementation Guidelines

### 1. Create a Unified Iterative Update System

The challenge is that simply making `checkNodeDirty` iterative won't solve the problem because:
- `checkNodeDirty` must call `source._update()` to ensure computed sources are current
- This creates a new recursive chain regardless of the iterative implementation
- The solution requires redesigning the entire update flow

Instead, create a unified iterative update function that:
- Combines the logic of `_update()`, `shouldNodeUpdate()`, and `checkNodeDirty()`
- Uses an explicit stack to manage the entire update process
- Never makes recursive function calls
- Maintains proper update order (sources before consumers)
- Works with any node that implements the Consumer/Producer interfaces

### 2. Key Logic to Preserve

The iterative version must maintain these behaviors:
- Fast path: return false if `node._globalVersion === ctx.version`
- Check each source for version changes
- For sources with `_update` method: ensure they're up-to-date before checking versions
- Update edge versions to match source versions
- Update node's global version when all sources are clean

### 3. Circular Dependency Detection

Track nodes currently being updated to detect cycles:
- Maintain a Set of nodes in the update path
- Throw "Cycle detected" error if a node is encountered twice
- Clean up tracking state properly on all exit paths

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

## Implementation Status

A proof of concept has been created (`iterative-update.ts`) that demonstrates:
- Elimination of all recursive calls using explicit stack
- Correct reactive behavior with all tests passing
- Performance improvements for shallow chains (10-20 levels)
- Need for optimization on deeper chains

## Common Pitfalls to Avoid

1. **Don't call any `_update()` method** - This restarts recursion
2. **Don't forget edge version updates** - Must happen even when sources are clean
3. **Don't skip global version updates** - Critical for performance
4. **Don't create new objects unnecessarily** - Reuse stack frames if possible
5. **Don't forget the RUNNING flag** - Prevents circular dependencies
6. **Optimize allocations** - The POC shows that naive stack allocation can hurt performance for deep chains

## Success Criteria

Your implementation is successful when:
1. All tests in `iterative-traversal.test.ts` pass
2. The benchmark shows >40% performance improvement for deep chains
3. No regressions in other benchmarks
4. Memory usage is equal or better than recursive version