import { ConsumerNode, ScheduledNode } from "./types";

/**
 * ALGORITHM: Context-Based State Isolation
 * 
 * SignalContext encapsulates all mutable global state for the reactive system.
 * This design enables:
 * 1. Thread safety: Each thread/request can have its own context
 * 2. SSR support: Isolated contexts prevent state leakage between requests
 * 3. Testing: Easy to reset state between tests
 * 4. Concurrent rendering: React concurrent features get isolated contexts
 * 
 * The context pattern is inspired by React's Context API and Zone.js.
 */
export interface SignalContext {
  // ALGORITHM: Implicit Dependency Tracking
  // When a computed/effect reads a signal, we need to know WHO is reading.
  // This field acts as an implicit parameter threaded through all reads.
  // Similar to React's Fiber tracking or Vue's targetStack.
  currentConsumer: ConsumerNode | null;
  
  // ALGORITHM: Global Version Clock (TEMPORAL CHANGE TRACKING)
  // Monotonically increasing counter that tracks ANY change in the system.
  // Incremented whenever ANY signal's value changes.
  // 
  // PURPOSE: Enables O(1) "has anything changed?" checks
  // - Avoids traversing entire dependency graph when system is stable
  // 
  // NOT REDUNDANT WITH GENERATION: This tracks WHEN changes occur,
  // while generation tracks WHICH dependencies are active.
  // 
  // OPTIMIZATION: Could use BigInt if overflow is a concern (unlikely in practice)
  version: number;
  
  // ALGORITHM: Transaction Batching
  // Tracks nesting depth of batch() calls for nested transactions.
  // Effects only run when batchDepth returns to 0.
  // Similar to database transaction nesting.
  batchDepth: number;
  
  // ALGORITHM: Circular Buffer for Effect Queue
  // These fields implement a power-of-2 sized circular buffer for scheduling effects.
  // Using a circular buffer avoids array resizing and provides O(1) enqueue/dequeue.
  // 
  // The queue uses the "one slot empty" technique to distinguish full from empty:
  // - Empty: head === tail
  // - Full: (tail + 1) & mask === head
  scheduledQueue: ScheduledNode[] | null;  // The buffer (lazy allocated)
  scheduledHead: number;                   // Index of next item to dequeue
  scheduledTail: number;                   // Index where next item will be enqueued
  scheduledMask: number;                   // Size - 1 for fast modulo via bit AND
  // OPTIMIZATION: Power-of-2 size enables (index & mask) instead of (index % size)
}

// PATTERN: Factory Function
// Creates a new isolated context with default values.
// Using a factory instead of a class avoids prototype overhead.
export function createContext(): SignalContext {
  return {
    currentConsumer: null,
    version: 0,
    batchDepth: 0,
    scheduledQueue: null, // OPTIMIZATION: Lazy allocation - only create if effects are used
    scheduledHead: 0,
    scheduledTail: 0,
    scheduledMask: 255, // 256 - 1 for fast modulo via bit masking
    // FLAG: Initial size of 256 might be too large for apps with few effects
    // TODO: Consider making initial size configurable or adaptive
  };
}
