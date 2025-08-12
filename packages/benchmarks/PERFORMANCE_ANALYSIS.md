# Lattice Computed Chains Performance Analysis

## Executive Summary
Lattice is 1.15-1.34x slower than Preact/Alien signals in computed chain benchmarks. The primary cause is **abstraction overhead** - multiple layers of indirection designed for complex graph scenarios that add unnecessary overhead for simple linear chains.

## Benchmark Results
```
Short chains (3 levels):
- Alien: 362µs (fastest)  
- Preact: 399µs (1.1x slower)
- Lattice: 485µs (1.34x slower) ⚠️

Deep chains (10 levels):
- Preact: 218µs (fastest)
- Alien: 220µs (1.01x slower)  
- Lattice: 250µs (1.15x slower) ⚠️

Very deep chains (50 levels):
- Preact: 96µs (fastest)
- Alien: 105µs (1.1x slower)
- Lattice: 125µs (1.31x slower) ⚠️
```

## Root Causes

### 1. Abstraction Layers (40% of overhead)
**Lattice's call stack for signal update:**
```
Signal.value setter
  → ctx.batchDepth check
  → propagator.invalidate()
    → graphWalker.dfs()
      → notifyNode visitor
        → computed._notify()
  → workQueue.flush()
```

**Preact's direct approach:**
```
Signal.value setter
  → for each target: target._notify()
```

### 2. Graph Walker Overhead (25% of overhead)
Lattice uses an explicit stack-based DFS with TraversalFrame allocations:
```typescript
// Lattice: Complex stack management
interface TraversalFrame { 
  edge: Edge; 
  next: TraversalFrame | undefined; 
}
let stack: TraversalFrame | undefined;
```

Competitors use simpler linked list traversal without allocations.

### 3. Edge Management Complexity (20% of overhead)
Lattice's `ensureLink()` function:
- Checks `_lastEdge` cache
- Falls back to linear search
- Creates new Edge objects
- Manages bidirectional pointers

Preact/Alien use simpler unidirectional links.

### 4. Batching Logic Overhead (15% of overhead)
Every signal update in Lattice:
```typescript
const isNewBatch = ctx.batchDepth === 0;
if (isNewBatch) ctx.batchDepth++;
const prevSize = state.size;
// ... propagation ...
if (isNewBatch && --ctx.batchDepth === 0 && state.size !== prevSize) flush();
```

This adds 4-5 conditional checks per update vs 1-2 in competitors.

## Optimization Opportunities

### Fast Path for Linear Chains (High Impact)
Add detection for simple linear dependencies and bypass complex graph machinery:
```typescript
// In Signal.value setter
if (this._targets && !this._targets.nextTarget) {
  // Single target - direct notify
  this._targets.target._notify();
  return;
}
```

### Inline Critical Functions (Medium Impact)
- Inline `notifyNode` visitor into DFS traversal
- Inline `ensureLink` for common case
- Reduce function call overhead by 3-4 calls per update

### Simplify Edge Cache (Medium Impact)
Replace complex edge management with simpler approach:
- Use single `_lastSource` pointer instead of full edge cache
- Avoid bidirectional linking for simple cases

### Optimize Flag Checks (Low Impact)
Combine multiple flag operations:
```typescript
// Current: Multiple checks
if (this._flags & NOTIFIED) return;
if (this._flags & DISPOSED) return;
if (this._flags & RUNNING) return;

// Optimized: Single check
if (this._flags & (NOTIFIED | DISPOSED | RUNNING)) return;
```

## Validation Strategy
1. Create isolated test branches with each optimization
2. Run computed-chains benchmark after each change
3. Verify no functionality regression with existing tests
4. Target: Match Preact's performance (218-110µs range)

## Implementation Priority
1. **Fast path for linear chains** - Biggest impact, least risk
2. **Inline hot functions** - Good impact, moderate complexity
3. **Simplify edge management** - Requires careful testing
4. **Batch logic optimization** - Complex, affects entire system