# Performance Analysis Report: Lattice vs Alien-Signals

## Executive Summary

Alien-signals outperforms Lattice in most benchmarks, with performance advantages ranging from 1.1x to 3.5x depending on the scenario. The primary cause is **excessive function call overhead in Lattice's pull phase** and less efficient dependency checking algorithms.

## Benchmark Results

### Where Alien-Signals Wins (and by how much):
- **Effect Triggers**: 3.47x faster
- **Grid Propagation**: 2.22x faster  
- **Conditional Dependencies**: 2.08x faster
- **Single Signal Updates**: 1.56x faster
- **Deep Chain Propagation**: 1.47x faster
- **Diamond Pattern**: 1.40x faster (in profiling)
- **Computed Chain**: 1.13x faster
- **Deep Tree**: 1.12x faster

### Where Lattice Wins:
- **Wide Fan-out**: 2.44x faster
- **Large Dependency Graph**: 1.23x faster
- **Memory Usage**: Generally more efficient

## Root Cause Analysis

### 1. **Pull Phase Function Call Overhead**

**Lattice's Pull Phase Call Stack:**
```
computed.get value()
  → _update()
    → shouldNodeUpdate()
      → checkNodeDirty()
        → _refresh() [recursive for each computed dependency]
          → checkNodeDirty() [again]
```

**Alien's Pull Phase:**
```
computedOper() [single function with inline checks]
  → checkDirty() [iterative with explicit stack]
```

**Impact**: Each computed read in Lattice involves 4-6 function calls vs 1-2 in Alien.

### 2. **Recursive vs Iterative Dependency Checking**

**Lattice** uses recursive `_refresh()` calls:
- Creates new stack frames for each level
- Worse cache locality
- Higher overhead for deep chains

**Alien** uses iterative traversal with explicit stack:
- Single stack frame
- Better cache locality
- Manual stack is more efficient than call stack

### 3. **Flag Management Complexity**

**Lattice** uses multiple flags:
- `OUTDATED` and `NOTIFIED` tracked separately
- Requires multiple bit operations
- More complex state transitions

**Alien** uses streamlined bit flags:
- Single flag field with efficient patterns
- Fewer state transitions
- Direct flag checks in hot paths

### 4. **Edge/Link Structure Overhead**

**Lattice's Edge**:
```typescript
{
  source, target, version,
  prevSource, nextSource,
  prevTarget, nextTarget
}
```

**Alien's Link**:
```javascript
{
  dep, sub,
  prevDep, nextDep,
  prevSub, nextSub
}
```

Similar structure, but Alien's traversal is more efficient.

## Specific Hot Path Issues

### Issue 1: Unnecessary Function Calls
Even when dependencies haven't changed, Lattice still goes through the full call stack. The global version optimization helps but doesn't eliminate the overhead.

### Issue 2: Double Dependency Checking
In `checkNodeDirty()`, Lattice does:
1. Version check
2. Call `_refresh()` on computed deps
3. Version check again

This creates redundant work.

### Issue 3: Poor Inlining
The multi-layer function structure prevents JavaScript engines from inlining hot path code effectively.

## Performance Optimization Recommendations

### 1. **Flatten the Pull Phase**
Combine `_update()`, `shouldNodeUpdate()`, and initial checks into a single method with inline flag checks.

### 2. **Replace Recursive with Iterative**
Convert `_refresh()` and `checkNodeDirty()` to use explicit stack iteration like Alien.

### 3. **Optimize Common Case**
Add fast path for "dependency hasn't changed" that avoids all function calls.

### 4. **Reduce Abstraction Layers**
Move hot path operations directly into the computed getter.

### 5. **Inline Critical Operations**
Use inline flag checks instead of function calls for common operations.

## Why This Matters

The 1.5-3x performance difference compounds in real applications:
- UI with 100 computeds × 60fps = 6,000 updates/second
- Each update being 2x slower = significant frame drops
- Deep dependency chains amplify the overhead

## Conclusion

Lattice's cleaner architecture and abstraction come at a performance cost. The main issue is **too many function calls in the hot path**. Alien-signals achieves better performance through:

1. Minimal abstraction in hot paths
2. Iterative algorithms over recursive
3. Inline operations over function calls
4. Optimized for the common case (unchanged dependencies)

To match Alien's performance, Lattice needs to reduce function call overhead in the pull phase and adopt iterative traversal algorithms.