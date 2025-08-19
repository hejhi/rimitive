# Hypothesis 008: Simplified Arrays Don't Close the Gap

## Date: 2025-08-19
## Status: **DISPROVEN** ❌

## Hypothesis

The simplified array-based signal implementation would match Alien Signals' performance, proving that simple data structures are the key to closing the performance gap.

## Results: Major Performance Gaps Remain

### Benchmark Comparison

| Operation | Alien | Simplified | Gap | Notes |
|-----------|-------|------------|-----|-------|
| **Signal reads** | 396 µs | 2,900 µs | **7.3x slower** | Basic read overhead |
| **Signal writes** | 412 µs | 2,250 µs | **5.7x slower** | Write + propagation |
| **Computed reads** | 401 µs | 3,060 µs | **7.6x slower** | Computed evaluation |
| **First linking (signal→computed)** | 311 µs | 6,290 µs | **20x slower** | Initial dependency setup |
| **First linking (computed→computed)** | 320 µs | 13,230 µs | **42x slower** | Complex dependency |
| **3-level chain** | 4.45 µs | 73.65 µs | **16.6x slower** | Short chains |
| **10-level chain** | 7.41 µs | 76.11 µs | **17.1x slower** | Deep chains |
| **1→5 fanout** | 38.74 µs | 2,860 µs | **74x slower** | Multiple subscribers |
| **1→20 fanout** | 111 µs | 13,010 µs | **336x slower** | Many subscribers |

## Root Cause Analysis

### 1. **Array Operations Are NOT Free**

The simplified implementation's "simple" arrays actually have terrible performance:

```javascript
// O(n) dependency check on EVERY access
if (activeSub && !activeSub._deps.includes(this)) {
  this._subs.push(activeSub);
}
```

- `Array.includes()` is O(n) linear search
- Gets worse with more dependencies
- Called on every tracked read

### 2. **Memory Allocation Explosion**

- **Alien**: ~400 bytes per cycle
- **Simplified**: 4-9 MB per cycle
- **22,500x more memory** allocation

Arrays are being created/resized constantly, causing:
- GC pressure
- Cache misses
- Memory fragmentation

### 3. **Missing Critical Optimizations**

Alien has sophisticated optimizations the simplified version lacks:

| Optimization | Alien | Simplified |
|--------------|-------|------------|
| Inline caches | ✅ | ❌ |
| Bit-packed flags | ✅ | ❌ |
| Version tracking | ✅ | ❌ |
| Monomorphic functions | ✅ | ❌ |
| Zero-allocation paths | ✅ | ❌ |

### 4. **V8 Optimization Failures**

The simplified code prevents V8 optimizations:
- Dynamic array growth → megamorphic property access
- Mixed array types → deoptimization
- Unpredictable branches → pipeline stalls

## What This Proves

1. **Simple ≠ Fast**: Array-based tracking can be SLOWER than complex graphs
2. **The problem isn't Edge complexity**: It's lack of fundamental optimizations
3. **Alien's secret**: Sophisticated V8-specific optimizations, not simplicity
4. **Lattice's real issue**: Not the data structure, but the implementation quality

## Paradox Explained

Why did simplified beat Lattice but lose to Alien?

- **vs Lattice**: Removed worst-case O(n²) graph traversals
- **vs Alien**: Added new O(n) operations without optimizations
- **Result**: Middle ground that's worse than both extremes

## Conclusion

**DISPROVEN**: The simplified array approach does NOT close the performance gap. In fact, it's 7-336x slower than Alien across all operations.

The performance gap is NOT primarily about data structure choice (arrays vs graphs) but about:
1. Implementation quality
2. V8-specific optimizations
3. Algorithmic complexity in hot paths
4. Memory allocation patterns

## Next Steps

To actually close the gap, we need:
1. Study Alien's actual optimization techniques
2. Implement zero-allocation hot paths
3. Use bit-packed state management
4. Design for V8's optimization pipeline
5. Consider keeping Edge structure but optimizing implementation