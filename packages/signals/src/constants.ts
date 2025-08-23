/**
 * ALGORITHM: Bit Flag State Management
 * 
 * This module defines bit flags used for efficient state tracking in reactive nodes.
 * Using bit flags is a classic optimization technique that provides:
 * 
 * 1. Memory efficiency: Multiple boolean states in a single 32-bit integer
 * 2. Cache efficiency: All state in one memory location
 * 3. Atomic operations: Update multiple states with one assignment
 * 4. Fast checks: Bitwise operations are faster than boolean logic
 * 
 * The flags use powers of 2 (via bit shifting) so they can be combined with
 * bitwise OR (|) and checked with bitwise AND (&).
 * 
 * PATTERN: Bit Manipulation
 * - Set flag: node._flags |= CONSTANTS.DIRTY
 * - Clear flag: node._flags &= ~CONSTANTS.DIRTY  
 * - Check flag: node._flags & CONSTANTS.DIRTY
 * - Check multiple: node._flags & (CONSTANTS.DIRTY | CONSTANTS.INVALIDATED)
 */
export const CONSTANTS = {
  // ALGORITHM: Push-Pull State Flags
  // These two flags implement the core push-pull algorithm:
  
  // INVALIDATED (bit 0): Set during "push" phase when a dependency changes.
  // Means "this node needs to be checked for staleness, etc. Check when accessed"
  // This enables lazy evaluation - we don't recompute until needed.
  INVALIDATED: 1 << 0,     // 1 (binary: 0000001)
  
  // DIRTY (bit 1): Set during "pull" phase when we confirm the node IS stale.
  // Means "this node's cached value is stale and MUST be recomputed"
  // Stronger guarantee than INVALIDATED.
  DIRTY: 1 << 1,     // 2 (binary: 0000010)
  
  // RUNNING (bit 2): Prevents infinite loops during computation.
  // Set while a computed/effect is executing to detect circular dependencies.
  // If we try to read a node with RUNNING set, we have a cycle.
  RUNNING: 1 << 2,      // 4 (binary: 0000100)
  
  // DISPOSED (bit 3): Node has been cleaned up and should be ignored.
  // Once set, the node is effectively dead and will be removed from the graph.
  // Used for resource cleanup and preventing memory leaks.
  DISPOSED: 1 << 3,     // 8 (binary: 0001000)
  
  // TRACKING (bit 4): Optimization flag for computed values.
  // Set when a computed has active consumers (someone depends on it).
  // If not set, we can skip some bookkeeping since nobody will read the value.
  // OPTIMIZATION: Enables "unobserved computed" optimization
  TRACKING: 1 << 4,     // 16 (binary: 0010000)
  
  // SCHEDULED (bit 5): Node is already in the work queue.
  // Prevents duplicate scheduling and replaces sentinel value pattern.
  // Set when enqueued, cleared when flushed.
  SCHEDULED: 1 << 5,     // 32 (binary: 0100000)
  
  // SKIP_EQUALITY (bit 6): Performance flag for subscriptions.
  // When set, skips the equality check and always notifies subscribers.
  // Used when the subscriber wants to be notified of every write,
  // even if the value didn't actually change.
  SKIP_EQUALITY: 1 << 6, // 64 (binary: 1000000)
  
  // OPTIMIZATION NOTE: Bits are ordered by frequency of checking:
  // - INVALIDATED/DIRTY are checked most often (every read)
  // - RUNNING/DISPOSED are checked during updates
  // - Others are checked less frequently
  // Lower bits = more frequent checks = better CPU branch prediction
  
  // COMPOUND FLAGS: Pre-computed combinations for efficient checks
  // These avoid multiple bitwise operations in hot paths
  
  // PENDING: Either INVALIDATED or DIRTY means the node needs attention
  PENDING: (1 << 0) | (1 << 1), // 3 (INVALIDATED | DIRTY)
  
  // SKIP_FLAGS: Flags that indicate we should skip processing  
  SKIP_FLAGS: (1 << 2) | (1 << 3), // 12 (RUNNING | DISPOSED)
  
  // ACTIVE_FLAGS: Node is actively being processed or disposed
  ACTIVE_FLAGS: (1 << 2) | (1 << 3) | (1 << 0) | (1 << 1), // 15 (all state flags)
}
