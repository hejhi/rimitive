import { ConsumerNode, ScheduledNode, Dependency } from "./types";
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
 * @returns The previous consumer (for restoration in endTracking)
 */
export function startTracking(ctx: GlobalContext, node: ConsumerNode): ConsumerNode | null {
  // Switch tracking context first
  const prevConsumer = ctx.currentConsumer;
  
  // Only increment version for top-level tracking (no parent consumer)
  ctx.trackingVersion++;
  
  // Reset dependency tail to start fresh dependency tracking
  node.dependencyTail = undefined;
  
  const flags = node.flags;
  node.flags = flags & ~(STATUS_DIRTY | STATUS_PENDING);
  
  ctx.currentConsumer = node;
  return prevConsumer;
}

/**
 * End tracking dependencies for a consumer node.
 * This is where we clean up stale dependencies.
 * 
 * @param ctx - The global context  
 * @param node - The consumer node ending tracking
 * @param prevConsumer - The previous consumer to restore
 */
export function endTracking(
  ctx: GlobalContext, 
  node: ConsumerNode,
  prevConsumer: ConsumerNode | null
): void {
  // Restore previous tracking context
  ctx.currentConsumer = prevConsumer;
  
  // Prune stale dependencies (like alien-signals)
  // Everything after the tail is stale and needs to be removed
  const tail = node.dependencyTail;
  let toRemove = tail ? tail.nextDependency : node.dependencies;
  
  // Remove all stale dependencies
  while (toRemove) {
    const next = toRemove.nextDependency;
    removeDependency(toRemove);
    toRemove = next;
  }
  
  // Set the node back to a clean state after tracking
  const flags = node.flags;
  node.flags = setStatus(flags, STATUS_CLEAN);
}

// Helper to remove a dependency edge (inlined from graph-edges logic)
function removeDependency(dependency: Dependency): void {
  const { producer, consumer, prevDependency, nextDependency, prevDependent, nextDependent } = dependency;

  if (nextDependency) nextDependency.prevDependency = prevDependency;
  else consumer.dependencyTail = prevDependency;

  if (prevDependency) prevDependency.nextDependency = nextDependency;
  else consumer.dependencies = nextDependency;

  if (nextDependent) nextDependent.prevDependent = prevDependent;
  else producer.dependentsTail = prevDependent;

  if (prevDependent) prevDependent.nextDependent = nextDependent;
  else producer.dependents = nextDependent;
}

/**
 * Detach all dependencies from a consumer node.
 * Used during disposal to completely disconnect a node from the graph.
 * 
 * @param node - The consumer node to detach
 */
export function detachAll(node: ConsumerNode): void {
  let dependency = node.dependencies;
  
  while (dependency) {
    const next = dependency.nextDependency;
    removeDependency(dependency);
    dependency = next;
  }
  
  node.dependencies = undefined;
  node.dependencyTail = undefined;
}
