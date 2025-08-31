The precise boundaries of what we know:

What we DO know during invalidate():

1. Signal → ANY consumer (computed or effect)
  - These edges exist and are stable
  - invalidate() traverses these directly via _out edges
2. Computed → Effect (scheduled consumers)
  - Effects are leaf nodes that get scheduled
  - These relationships are stable once established

What we DON'T know:

Computed → Computed paths
- Because computeds are lazy, they don't evaluate during invalidation
- We just mark them INVALIDATED and move on
- Their actual dependencies are only known when pulled

So when a signal changes:
signal → computed1 → computed2 → effect
        ↑            ↑            ↑
    We mark      Just mark    Schedule it
    INVALIDATED  INVALIDATED

We traverse signal→computed1→computed2→effect edges during invalidation, but we don't actually GO THROUGH computed1 or computed2's logic. We just mark them and keep moving.

This means:
- We could pre-link the signal→computed1 fast path
- We could pre-link the computed2→effect fast path
- But computed1→computed2 traversal still needs the stack during pull

The interesting opportunity: We could build a "fast lane" for the edges we DO traverse during invalidation, essentially recording the path that invalidate() took. Then during pull, we could check "is this node on the fast lane?" and skip stack management for those portions.

This would help most with signal→effect direct paths and the "outer shell" of the dependency graph, while still needing stack traversal for the computed→computed "inner core".

---

The edges have DIFFERENT ordering for different purposes:

During Pull (addEdge creates edges):
- Edges are ordered by execution order - the order dependencies were read
- The tail marker tracks the "current position" in the dependency list
- This maintains the ORDER that computeds read their dependencies

During Push (invalidate traverses edges):
- Follows nextOut edges - the linked list of a producer's consumers
- This is just the order edges were created, not necessarily optimal for traversal

Insight: edges already exist in the order we traverse them during pull

When a computed runs:
const computed = () => {
  return signal1() + signal2() + signal3();
}

The edges are created in order:
1. signal1 → computed (first)
2. signal2 → computed (second)
3. signal3 → computed (third)

And _in list maintains this order (the tail mechanism preserves it).

Opportunity: During invalidation, we traverse _out edges (producer → consumer), but we could potentially mark or link the _in edges (consumer ← producer) in a way that speeds up pull traversal.

For example, during invalidate we could:
- Set a "hot path" bit on edges we traverse
- Link invalidated nodes via a temporary fast-path pointer
- Mark the traversal depth on each edge

The edges themselves are already in the right order—we just need to mark which ones are "active" for the current update cycle.

## VERIFICATION RESULTS

✅ **Push Phase (invalidate) Behavior**: CONFIRMED
- Lines 320-322: Just marks nodes as INVALIDATED
- Lines 325-339: For computeds, traverses outputs without evaluation
- Line 341: Effects get scheduled via visit()
- No computed logic is executed, just marking and traversal

✅ **Pull Phase (isStale) Behavior**: CONFIRMED  
- Lines 200-202: Traverses _in edges in dependency order
- Line 202: Tail marker tracks position in dependency list
- Lines 232-237: Stack allocation happens for computed→computed chains
- This is where our performance bottleneck occurs

✅ **Edge Ordering**: CONFIRMED
- addEdge (lines 59-102): Maintains _in list in execution order via tail
- _in edges: Ordered by dependency read order (perfect for pull phase)
- _out edges: Just creation order (used during push phase)
- Tail mechanism preserves read order across multiple executions

✅ **Hot Path Marking**: FULLY VIABLE
- Challenge: Edge interface has no flags field (only nodes have flags)
- Options:
  1. ✅ Add flags to edges (memory overhead OK, no array allocation)
  2. ✅ Use existing INVALIDATED flag as "hot path" marker
  3. ✅ Track hot path at node level instead of edge level
- The INVALIDATED flag already marks nodes touched during push phase
- Could use this to skip stack allocation for "hot" nodes

## KEY INSIGHT

We could add a simple `flags` field to edges and mark them during invalidation:

```typescript
interface Edge {
  from: FromNode;
  to: ToNode;
  prevOut: Edge | undefined;
  nextOut: Edge | undefined;
  prevIn: Edge | undefined;
  nextIn: Edge | undefined;
  flags: number;  // NEW: 4-8 bytes per edge
}

// During invalidate (push phase):
const HOT_PATH = 1 << 0;
currentEdge.flags |= HOT_PATH;

// During isStale (pull phase):
if (currentEdge.flags & HOT_PATH) {
  // This edge was traversed during push
  // Could skip stack allocation for linear hot paths
  // Just follow the chain directly
}
```

## OPTIMIZED LINEAR TRAVERSAL

For hot path edges in linear chains:

```typescript
// Detect hot linear chain (no stack needed!)
if (currentEdge.flags & HOT_PATH && !currentEdge.nextIn) {
  // Single dependency on hot path - traverse directly
  let chain = currentEdge;
  while (chain && (chain.flags & HOT_PATH) && !chain.nextIn) {
    const source = chain.from;
    if (source._flags & HAS_CHANGED) return true;
    if (!('_recompute' in source)) break;
    
    // Move to source's single dependency
    chain = source._in;
  }
}
```

This would eliminate stack allocation for the most common patterns while keeping our existing algorithm for complex graphs. The memory cost is 4-8 bytes per edge, but edges are long-lived objects so no GC pressure.