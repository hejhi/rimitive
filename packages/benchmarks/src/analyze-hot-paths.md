# Performance Analysis: Lattice vs Alien-Signals

## Benchmark Results Summary

Based on the benchmark runs, alien-signals consistently outperforms lattice in several key scenarios:

### Key Performance Deltas:
1. **Single Signal Updates**: Alien is ~1.56x faster
2. **Computed Chain**: Alien is ~1.13x faster 
3. **Deep Tree**: Alien is ~1.12x faster
4. **Diamond Pattern**: Alien is ~1.10x faster
5. **Conditional Dependencies**: Alien is ~2.08x faster for inactive branch updates
6. **Effect Triggers**: Alien is ~3.47x faster
7. **Grid Propagation**: Alien is ~2.22x faster than lattice

### Areas Where Lattice Performs Better:
1. **Wide Fan-out**: Lattice is ~2.44x faster than alien
2. **Large Dependency Graph**: Lattice is ~1.23x faster
3. **Memory efficiency**: Lattice generally uses less memory

## Hot Path Analysis

### 1. Pull Phase Differences

**Lattice's Pull Phase (`computed.ts:_update()`)**:
```typescript
_update(): void {
  // Global version check (fast path)
  if (this._globalVersion === ctx.version && !(this._flags & (OUTDATED | NOTIFIED))) {
    return;
  }
  
  // Calls shouldNodeUpdate which calls checkNodeDirty
  if (shouldNodeUpdate(this)) {
    this._recompute();
  }
}
```

**Alien's Pull Phase**:
```javascript
function computedOper() {
  const flags = this.flags;
  if (flags & 16 || (flags & 32 && checkDirty(this.deps, this))) {
    if (updateComputed(this)) {
      // ... propagation
    }
  }
  // Direct value return
  return this.value;
}
```

### 2. Dependency Checking Overhead

**Lattice (`dependency-tracking.ts:checkNodeDirty()`)**:
- Uses a three-phase check: version mismatch, refresh, version after refresh
- Calls `_refresh()` on computed dependencies (recursive)
- More function calls in the hot path

**Alien (`checkDirty()`)**:
- Uses bit flags more efficiently
- Iterative traversal with explicit stack management
- Fewer function calls, more inline operations

### 3. Function Call Overhead

**Lattice**:
- `_update()` → `shouldNodeUpdate()` → `checkNodeDirty()` → `_refresh()` (recursive)
- Each layer adds overhead
- More abstraction layers

**Alien**:
- Direct flag checks in hot paths
- Inline operations where possible
- Manual stack management instead of recursion

### 4. Edge/Link Management

**Lattice**:
- Edge caching optimization helps but still has overhead
- Separate prevSource/nextSource and prevTarget/nextTarget pointers
- More complex edge structure

**Alien**:
- Simpler link structure
- More efficient traversal with explicit stack
- Better cache locality

## Key Performance Issues in Lattice

### 1. **Excessive Function Calls in Hot Path**
The pull phase has too many function call layers. Each computed access goes through:
- `get value()` → `_update()` → `shouldNodeUpdate()` → `checkNodeDirty()` → potentially recursive `_refresh()` calls

### 2. **Recursive Dependency Checking**
The `_refresh()` pattern creates recursive calls for deep dependency chains, leading to:
- Stack frame overhead
- Worse cache locality
- More function call overhead

### 3. **Complex Flag Management**
Lattice uses separate NOTIFIED and OUTDATED flags that require multiple checks and updates. Alien uses a more streamlined bit flag approach.

### 4. **Edge Structure Overhead**
The edge structure in lattice has more fields and more complex management, leading to:
- More memory allocations
- More pointer chasing
- Worse cache locality

## Recommendations for Optimization

1. **Reduce Function Call Layers**: Inline hot path operations where possible
2. **Iterative Instead of Recursive**: Replace recursive `_refresh()` with iterative traversal
3. **Optimize Flag Operations**: Use more efficient bit flag patterns like alien-signals
4. **Simplify Edge Structure**: Reduce the number of pointers and fields in edges
5. **Better Cache Locality**: Keep related data closer together in memory

## Why Alien-Signals is Faster

1. **Minimal Abstraction**: Direct operations without multiple function layers
2. **Efficient Bit Flags**: Single flag field with efficient bit operations
3. **Iterative Traversal**: Explicit stack management instead of recursion
4. **Simpler Data Structures**: Less overhead in link/edge management
5. **Optimized for Common Case**: Fast paths for unchanged dependencies