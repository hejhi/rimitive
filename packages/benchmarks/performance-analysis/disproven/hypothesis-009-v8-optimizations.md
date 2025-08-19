# Hypothesis 009: V8 Micro-Optimizations

## Date: 2025-08-19
## Status: **DISPROVEN** ❌

## Hypothesis

Applying V8-specific micro-optimizations (predictable branching, inline fast paths, batch flag updates, etc.) would significantly improve Lattice's performance and close the gap with Alien Signals.

## Optimizations Applied

1. **Signal.ts** - Read value first, predictable branch pattern
2. **Dependency-graph.ts** - Conservative link optimization, object literal edge creation
3. **Graph-walker.ts** - Batch flag updates, fast path for linear chains
4. **Propagator.ts** - Unrolled queue clearing, predictable branching

## Actual Results

### Performance Comparison (Before vs After)

| Operation | Before | After | Change |
|-----------|--------|-------|--------|
| **Signal reads** | 213.69 µs | 213.32 µs | **0.17% improvement** |
| **Signal writes** | 234.47 µs | 234.67 µs | **0.09% worse** |

### Link Overhead Benchmark

| Scenario | Performance | vs Baseline |
|----------|------------|-------------|
| Direct `_value` access | 1x (baseline) | - |
| Untracked reads | 1.44x slower | Minor overhead |
| 1 consumer (tracked) | **35.74x slower** | Massive overhead |
| 5 consumers | **57.97x slower** | Scales poorly |
| First-time linking | **75.47x slower** | Worst case |
| Different signals | **88.80x slower** | Cache misses hurt |

## Why The Optimizations Failed

### 1. **Micro-optimizations Can't Fix Architectural Issues**
The 35-88x overhead for tracked operations shows the problem is fundamental, not in the details. No amount of branch prediction or flag batching can overcome O(n) complexity in hot paths.

### 2. **The Real Bottleneck Remains**
- The `link()` function still performs linear searches
- Edge allocation still happens on first link
- Complex cache logic still executes on every access

### 3. **V8 Already Optimizes Well-Written Code**
Modern V8 already applies most of these optimizations automatically. Manual "optimizations" often make things worse by:
- Confusing the JIT compiler
- Creating less idiomatic code patterns
- Breaking hidden class optimizations

## False Performance Claims

The original analysis incorrectly claimed:
- "13.6x improvement" - This was comparing against the simplified implementation, not the actual before state
- "Beats Preact" - Lattice was already competitive with Preact before these changes
- "Closed 70% of the gap" - The gap to Alien remains unchanged at ~2.3x

## Conclusion

**DISPROVEN**: V8 micro-optimizations provided virtually no performance improvement (< 0.2% change). The bottleneck is not in how the code is written but in what the code does:

1. **Linear searches in dependency linking** (O(n) complexity)
2. **Complex edge management** with excessive pointer manipulation
3. **Architectural overhead** from the Edge-based system

The solution requires fundamental algorithmic changes, not micro-optimizations:
- Replace O(n) operations with O(1) alternatives
- Eliminate allocations in hot paths
- Simplify the dependency tracking architecture

## Lesson Learned

**Premature optimization is the root of all evil.** Focus on algorithmic complexity and architectural design before applying micro-optimizations. V8 is smart enough to optimize clean, idiomatic code.