import { ConsumerNode, ScheduledNode } from "./types";
import type { GraphEdges } from "./helpers/graph-edges";
import type { PushPropagator } from "./helpers/push-propagator";
import type { PullPropagator } from "./helpers/pull-propagator";
import type { NodeScheduler } from "./helpers/node-scheduler";

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
  
  // Composable helpers for graph operations
  graphEdges: GraphEdges;
  pushPropagator: PushPropagator;
  pullPropagator: PullPropagator;
  nodeScheduler: NodeScheduler;
}

// PATTERN: Factory Function
// Creates a new isolated context with default values.
// Using a factory instead of a class avoids prototype overhead.
// This is the base context without helpers - use createDefaultContext for a complete context
export function createBaseContext(): SignalContext {
  return {
    currentConsumer: null,
    batchDepth: 0,
    queueHead: undefined,
    queueTail: undefined,
  } as SignalContext; // Cast since helpers will be added by createDefaultContext
}
