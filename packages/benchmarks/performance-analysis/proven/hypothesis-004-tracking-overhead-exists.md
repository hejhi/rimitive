# Hypothesis 004: Tracking Infrastructure Overhead Exists

## Date: 2025-08-19
## Status: **PROVEN** ✅

## Hypothesis

Lattice signals have measurable overhead (~2.74x) compared to raw property access due to dependency tracking infrastructure, even for untracked reads.

## Test Method

Compared three access patterns:
1. Raw object property access
2. Signal value getter (with tracking logic)
3. Direct `_value` property access (bypassing tracking)

## Results

**Micro-benchmark results (1M reads):**
- Raw property access: 1.30ms
- Signal.value getter: 3.56ms  
- Direct `_value` access: 1.30ms
- **Overhead: 2.74x**

**Real-world benchmark:**
- Lattice signal reads: 213.89 µs/iter
- Alien signal reads: 92.55 µs/iter
- **Overhead: 2.31x**

## What This Proves

1. **Tracking infrastructure has cost**: Even untracked reads go through tracking checks
2. **The overhead is consistent**: ~2.3-2.7x across different measurements
3. **Bypassing the getter eliminates overhead**: Direct `_value` access matches raw property speed

## What This Does NOT Prove

This does NOT identify the specific cause of the overhead. It only confirms overhead exists.

## Conclusion

**PROVEN**: Lattice's signal read implementation has ~2.74x overhead compared to raw property access due to its tracking infrastructure. This overhead exists even when no tracking is actually needed (untracked reads).