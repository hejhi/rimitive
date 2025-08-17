⏺ Comparison: Lattice vs Alien Signals vs Preact Signals

1. Propagation Strategy

| Aspect         | Lattice (Our Branch)            | Alien Signals                 | Preact Signals                        |
|----------------|---------------------------------|-------------------------------|---------------------------------------|
| Trigger        | Immediate on signal change      | Immediate on signal change    | Immediate on signal change            |
| Traversal      | Inline DFS with intrusive stack | DFS with heap-allocated stack | Direct iteration over targets         |
| Effect Queuing | Intrusive linked list           | Array (queuedEffects[])       | Intrusive linked list (batchedEffect) |
| Batching       | batchDepth counter              | batchDepth counter            | batchDepth + startBatch()             |

2. Data Structures

Lattice:
// Intrusive linked list for effects
queueHead/queueTail: ScheduledNode
// Temporary field for stack
interface StackableEdge { stackNext?: Edge }

Alien Signals:
// Array for effects
const queuedEffects: (Effect | EffectScope | undefined)[] = [];
// Heap-allocated stack frames
interface Stack<T> { value: T; prev: Stack<T> | undefined; }

Preact Signals:
// Intrusive linked list for effects
let batchedEffect: Effect | undefined = undefined;
// Direct traversal (no stack needed)
for (let node = this._targets; node !== undefined; node = node._nextTo)

3. Key Algorithmic Differences

Lattice:
- Two-phase: Traverse graph → Queue effects → Flush queue
- Complex type checking: '_targets' in target && '_version' in target
- Separate fast path for single target

Alien Signals:
- Complex flag-based state machine with RecursedCheck, Recursed, Dirty, Pending
- Uses notify() callback during traversal
- Sophisticated cycle detection with recursion flags

Preact Signals:
- Simple _notify() on each target
- Effects maintain their own linked list
- Cycle detection via iteration counter (batchIteration > 100)

4. Memory Allocation Patterns

|                  | Lattice            | Alien         | Preact           |
|------------------|--------------------|---------------|------------------|
| Effect Queue     | Zero (intrusive)   | Array growth  | Zero (intrusive) |
| Traversal Stack  | Zero (field reuse) | Heap objects  | None needed      |
| Dependency Edges | Pre-allocated      | Pre-allocated | Node objects     |

5. Performance Characteristics

Why Alien is Fastest:
1. Simpler traversal - No type checking during propagation
2. Optimized flags - Single bit operation vs multiple checks
3. Tighter loop - Less branching in hot path

Why Preact is Competitive:
1. No stack needed - Direct iteration over targets
2. Simple notify - Just calls _notify() on each target
3. Intrusive batching - Zero allocation for effects

Why Lattice is Slower (but cleaner):
1. Type guards - Runtime checks for ProducerNode
2. Stack management - Even though zero-alloc, still overhead
3. Abstraction cost - More indirection for type safety

6. Code Complexity

// Lattice - Explicit and type-safe
if ('_targets' in target && '_version' in target) {
  const childTargets = (target as ConsumerNode & ProducerNode)._targets;
}

// Alien - Compact but cryptic
if (flags & 60 as ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed | ReactiveFlags.Dirty | ReactiveFlags.Pending) {
  sub.flags = flags | 32 satisfies ReactiveFlags.Pending;
}

// Preact - Simple and direct
for (let node = this._targets; node !== undefined; node = node._nextTo) {
  node._target._notify();
}

Summary

Our Lattice implementation achieves zero allocations like Preact but with more complex traversal logic. Alien Signals wins on raw performance through aggressive optimization and
bit manipulation, while Preact keeps it simple. Our approach prioritizes type safety and maintainability while achieving the core goal of immediate propagation with intrusive data
structures.