export const CONSTANTS = {
  // INVALIDATED (bit 0): Set during "push" phase when a dependency changes.
  // Means "this node MIGHT be stale, needs checking when accessed"
  // This enables lazy evaluation - we don't recompute until needed.
  INVALIDATED: 1 << 0,  // 1 (binary: 0000001)
  
  // DIRTY (bit 1): Set during "pull" phase when we confirm the node IS stale.
  // Means "this node's cached value is definitely stale and MUST be recomputed"
  DIRTY: 1 << 1,     // 2 (binary: 0000010)
  
  // RUNNING (bit 2): Prevents infinite loops during computation.
  // Set while a computed/effect is executing to detect circular dependencies.
  // If we try to read a node with RUNNING set, we have a cycle.
  RUNNING: 1 << 2,      // 4 (binary: 0000100)
  
  // DISPOSED (bit 3): Node has been cleaned up and should be ignored.
  // Once set, the node is effectively dead and will be removed from the graph.
  // Used for resource cleanup and preventing memory leaks.
  DISPOSED: 1 << 3,     // 8 (binary: 0001000)
  
  // OBSERVED (bit 4): Node has active observers/subscribers.
  // When clear, we can skip propagation since no one is listening.
  // Part of the hybrid push-pull optimization.
  OBSERVED: 1 << 4,      // 16 (binary: 0010000)
  
  // SCHEDULED (bit 5): Node is already in the work queue.
  // Prevents duplicate scheduling and replaces sentinel value pattern.
  // Set when enqueued, cleared when flushed.
  SCHEDULED: 1 << 5,     // 32 (binary: 0100000)
}
