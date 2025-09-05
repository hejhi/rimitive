import { ConsumerNode, ScheduledNode } from "./types";
import { CONSTANTS, createFlagManager } from './constants';

const { STATUS_CLEAN, STATUS_DIRTY, STATUS_PENDING } = CONSTANTS;
const { setStatus } = createFlagManager();

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

/**
 * ALGORITHM: Centralized Tracking State Management
 * 
 * Based on alien-signals' approach, we centralize the tracking lifecycle.
 * This ensures consistent state management across all consumers.
 */

/**
 * Start tracking dependencies for a consumer node.
 * This prepares the node to record new dependencies.
 * 
 * @param ctx - The global context
 * @param node - The consumer node starting to track dependencies
 * @param incrementVersion - Whether to increment the global tracking version
 */
export function startTracking(ctx: GlobalContext, node: ConsumerNode, incrementVersion = true): void {
  // Increment tracking version if this is a top-level tracking operation
  // Nested computeds/effects reuse the parent's tracking version
  if (incrementVersion && !ctx.currentConsumer) {
    ctx.trackingVersion++;
  }
  
  // Reset dependency tail to start fresh dependency tracking
  // This allows us to detect which dependencies are accessed in this cycle
  node.dependencyTail = undefined;
  
  // Clear status flags that might interfere with tracking
  // Similar to alien-signals clearing Recursed/Dirty/Pending and setting RecursedCheck
  // We keep it simpler - just ensure we're not in a dirty state during tracking
  if ('flags' in node) {
    const flags = (node as any).flags;
    // Clear DIRTY and PENDING, keep other flags
    (node as any).flags = flags & ~(STATUS_DIRTY | STATUS_PENDING);
  }
}

/**
 * End tracking dependencies for a consumer node.
 * This is where we clean up stale dependencies.
 * 
 * @param ctx - The global context  
 * @param node - The consumer node ending tracking
 * @param pruneCallback - Function to prune stale dependencies
 */
export function endTracking(
  _ctx: GlobalContext, 
  node: ConsumerNode,
  pruneCallback: (node: ConsumerNode) => void
): void {
  // Prune stale dependencies that weren't accessed in this tracking cycle
  pruneCallback(node);
  
  // Set the node back to a clean state after tracking
  if ('flags' in node) {
    const flags = (node as any).flags;
    (node as any).flags = setStatus(flags, STATUS_CLEAN);
  }
}
