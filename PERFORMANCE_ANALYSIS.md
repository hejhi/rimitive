# Lattice Performance Analysis & Optimization Research

## Executive Summary

Lattice's reactive system shows distinct performance characteristics across dependency patterns:
- **Excels at wide patterns** (1.3-1.4x faster than competitors)
- **Struggles with deep chains** (1.9-2.4x slower than competitors)  
- **Tree patterns are worst-case** (1.6-1.7x slower)

## Benchmark Results

### Pattern Performance Matrix

| Pattern | Description | Lattice | Preact | Alien | Lattice vs Best |
|---------|------------|---------|---------|-------|-----------------|
| **Linear Chain (10)** | a→b→c...→j | 347µs | 185µs | 199µs | 1.87x slower |
| **Linear Chain (50)** | a→b→c...→z | 208µs | 88µs | 93µs | 2.37x slower |
| **Simple Diamond** | 2-3 converging paths | 1040µs | 670µs | 573µs | 1.81x slower |
| **Wide Diamond** | 10 parallel paths | 218µs | 307µs | 292µs | **1.34x FASTER** |
| **Wide Tree** | 5×3 (155 nodes) | 50µs | 31µs | 32µs | 1.60x slower |
| **Deep Tree** | 3×4 (120 nodes) | 137µs | 82µs | 82µs | 1.68x slower |

## Algorithmic Analysis

### Current Implementation (dependency-graph.ts)

Lattice uses a **push-pull hybrid** with manual stack management:
```typescript
// Stack-based traversal with manual frame management
stack = { edge, node, stale, prev: stack };
// Edge pruning with tail markers
if (node._inTail && edge === node._inTail.nextIn) break;
```

**Strengths:**
- Tail marker optimization for wide graphs
- Aggressive edge pruning
- Intrusive linked lists (zero allocation)

**Weaknesses:**
- Stack frame overhead per recursion level
- Complex bookkeeping for simple patterns
- No pattern-specific optimizations

### Competitor Approaches

**Preact:** Simple global version counters
```typescript
if (this._globalVersion === globalVersion) return true;
```
- Minimal overhead for simple patterns
- Amortizes well with depth

**Alien:** Complex flag state machine
```typescript
if (!(flags & 60 /* RecursedCheck | Recursed | Dirty | Pending */)) { }
```
- Balanced performance across patterns
- Higher complexity but consistent

## Key Findings

### 1. Wide Pattern Advantage
Lattice's tail markers and edge pruning excel when:
- Multiple parallel dependencies exist (5+ edges)
- Graph changes frequently (conditional dependencies)
- Nodes have high fanout

### 2. Deep Chain Inefficiency
Stack overhead compounds with depth because:
- Each level allocates a StackFrame object
- No amortization benefits (unlike version checking)
- Cache misses increase with stack depth

### 3. Tree Pattern Challenge
Trees combine both weaknesses:
- Stack overhead from depth
- Complex edge management from width
- Worst-case for current algorithm

## Implemented Optimizations

### 1. Flag Caching (✅ Merged)
```typescript
// Before: double read
if (!(state._flags & VALUE_CHANGED)) state._flags |= VALUE_CHANGED;

// After: cached read
const flags = state._flags;
if (!(flags & VALUE_CHANGED)) state._flags = flags | VALUE_CHANGED;
```
**Result:** ~2% improvement across all patterns

### 2. Pattern Detection (✅ Merged)
```typescript
// Ultra-lightweight detection using existing edges
const firstIn = node._in;
if (firstIn && !firstIn.nextIn) pattern = 'linear';
else if (/* has 5+ deps */) pattern = 'wide';
```
**Result:** <2% overhead, enables future optimizations

## Recommended Optimizations

### Priority 1: Linear Chain Optimization
For detected linear patterns, implement iterative traversal:
- Avoid stack frame allocation
- Walk chain iteratively bottom-to-top
- Recompute in forward pass
- Expected improvement: 50-75% faster on deep chains

### Priority 2: Wide Pattern Fast Path
For detected wide patterns (5+ deps):
- Batch flag operations
- Use specialized traversal order
- Cache hot edges
- Expected improvement: 10-20% faster on wide patterns

### Priority 3: Tree Pattern Hybrid
For mixed patterns:
- Switch algorithms at depth boundaries
- Use breadth-first for wide levels
- Use iterative for linear segments
- Expected improvement: 30-40% faster on trees

## Implementation Constraints

Must preserve:
- Existing node properties and flags (no new fields)
- Edge structure (intrusive linked lists)
- Correctness of recomputation order
- Memory efficiency (no allocations in hot path)

## Next Steps

1. Implement linear chain optimization using detected patterns
2. Benchmark against full test suite
3. Add wide pattern optimizations if time permits
4. Consider tree-specific algorithm for mixed patterns

## Code Locations

- Main algorithm: `/packages/signals/src/helpers/dependency-graph.ts:isStale()`
- Pattern detection: Lines 159-189
- Benchmarks: `/packages/benchmarks/src/suites/lattice/`
- Tests: `/packages/signals/src/**/*.test.ts`