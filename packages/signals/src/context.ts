import { ConsumerNode, ScheduledNode } from "./types";

/**
 * ALGORITHM: Context-Based State Isolation
 * 
 * GlobalContext encapsulates all mutable global state for the reactive system.
 * This design enables:
 * 1. Thread safety: Each thread/request can have its own context
 * 2. SSR support: Isolated contexts prevent state leakage between requests
 * 3. Testing: Easy to reset state between tests
 * 4. Concurrent rendering: React concurrent features get isolated contexts
 * 
 * The context pattern is inspired by React's Context API and Zone.js.
 */
export interface GlobalContext {
  // ALGORITHM: Implicit Dependency Tracking
  // When a computed/effect reads a signal, we need to know WHO is reading.
  // This field acts as an implicit parameter threaded through all reads.
  // Similar to React's Fiber tracking or Vue's targetStack.
  currentConsumer: ConsumerNode | null;

  // ALGORITHM: Version-Based Dependency Tracking
  // Each recomputation/flush cycle increments this version counter.
  // Dependencies touched during tracking get marked with the current version.
  // This enables simple staleness detection: version !== currentVersion means stale.
  trackingVersion: number;

  // ALGORITHM: Transaction Batching
  // Tracks nesting depth of batch() calls for nested transactions.
  // Effects only run when batchDepth returns to 0.
  // Similar to database transaction nesting.
  batchDepth: number;

  // ALGORITHM: Intrusive Linked List for Effect Queue
  // Head and tail of queued effects list for O(1) enqueue and dequeue
  // Uses _nextScheduled field on nodes to form the list (no allocations)
  queueHead: ScheduledNode | undefined;
  queueTail: ScheduledNode | undefined;
}

// PATTERN: Factory Function
// Creates a new isolated context with default values.
// Using a factory instead of a class avoids prototype overhead.
// This is the base context without helpers - use createDefaultContext for a complete context
export function createBaseContext(): GlobalContext {
  return {
    currentConsumer: null,
    trackingVersion: 0,
    batchDepth: 0,
    queueHead: undefined,
    queueTail: undefined,
  } as GlobalContext; // Cast since helpers will be added by createDefaultContext
}