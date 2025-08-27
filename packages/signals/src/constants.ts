export const CONSTANTS = {
  // DIRTY and INVALIDATED are mutually exclusive approaches to staleness:
  // - one for lazy (unobserved)
  // - one for eager (observed) tracking

  // INVALIDATED: Set during "push" phase when a dependency changes.
  // Triggers checking.
  // Means "this node MIGHT be stale, needs checking when accessed"
  // This enables lazy evaluation - we don't recompute until needed.
  INVALIDATED: 1 << 0,

  // DIRTY: Set during "pull" phase when we confirm the node IS stale.
  // Forces recompute.
  // Means "this node's cached value is definitely stale and MUST be recomputed"
  DIRTY: 1 << 1,

  // VALUE_CHANGED: Producer's value has changed since creation.
  // Stops propagation.
  // Similar to the _dirty boolean, but for Producers.
  // Set when signal value changes, never cleared (permanent change flag).
  VALUE_CHANGED: 1 << 2,

  // OBSERVED: Node has active observers/subscribers.
  // When clear, we can skip propagation since no one is listening.
  // Part of the hybrid push-pull optimization.
  OBSERVED: 1 << 3,

  // RUNNING: Prevents infinite loops during computation.
  // Set while a computed/effect is executing to detect circular dependencies.
  // If we try to read a node with RUNNING set, we have a cycle.
  RUNNING: 1 << 4,

  // DISPOSED: Node has been cleaned up and should be ignored.
  // Once set, the node is effectively dead and will be removed from the graph.
  // Used for resource cleanup and preventing memory leaks.
  DISPOSED: 1 << 5,

  // SCHEDULED: Node is already in the work queue.
  // Prevents duplicate scheduling and replaces sentinel value pattern.
  // Set when enqueued, cleared when flushed.
  SCHEDULED: 1 << 6,
};
