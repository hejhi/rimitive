export const CONSTANTS = {
  // DIRTY (bit 0): Set when a dependency changes or node is stale.
  // Means "this node's cached value is stale and MUST be recomputed"
  DIRTY: 1 << 0,     // 1 (binary: 0000001)
  
  // RUNNING (bit 1): Prevents infinite loops during computation.
  // Set while a computed/effect is executing to detect circular dependencies.
  // If we try to read a node with RUNNING set, we have a cycle.
  RUNNING: 1 << 1,      // 2 (binary: 0000010)
  
  // DISPOSED (bit 2): Node has been cleaned up and should be ignored.
  // Once set, the node is effectively dead and will be removed from the graph.
  // Used for resource cleanup and preventing memory leaks.
  DISPOSED: 1 << 2,     // 4 (binary: 0000100)
  
  // SCHEDULED (bit 4): Node is already in the work queue.
  // Prevents duplicate scheduling and replaces sentinel value pattern.
  // Set when enqueued, cleared when flushed.
  SCHEDULED: 1 << 4,     // 16 (binary: 0010000)
}
