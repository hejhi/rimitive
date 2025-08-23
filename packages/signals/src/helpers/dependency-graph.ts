/**
 * ALGORITHM: Bidirectional Dependency Graph Management
 * 
 * This module implements the core graph algorithms that power the reactive system.
 * The key insight is using a bidirectional graph with intrusive linked lists:
 * 
 * INSPIRATION:
 * - Glimmer's reference system (version tracking)
 * - Linux kernel's intrusive lists (memory efficiency)  
 * - V8's inline caches (edge caching)
 * - Database query planners (dependency analysis)
 */
import { CONSTANTS } from '../constants';
import type { ProducerNode, ConsumerNode, Edge, ToNode, FromNode, DerivedNode, ScheduledNode } from '../types';

const { TRACKING, INVALIDATED, DIRTY, DISPOSED, RUNNING } = CONSTANTS;
const SKIP_FLAGS = INVALIDATED | DISPOSED | RUNNING;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface DependencyGraph {
  // Edge management
  addEdge: (
    producer: ProducerNode,
    consumer: ConsumerNode,
    trackingVersion: number
  ) => void;
  removeEdge: (edge: Edge) => Edge | undefined;

  // Cleanup operations
  detachAll: (consumer: ConsumerNode) => void;
  pruneStale: (consumer: ConsumerNode) => void;

  // Staleness checks
  isStale: (node: DerivedNode) => boolean; // For derived nodes
  needsFlush: (node: ScheduledNode) => boolean; // For scheduled nodes
  invalidate: (
    from: Edge | undefined,
    visit: (node: ScheduledNode) => void
  ) => void;
}

export function createDependencyGraph(): DependencyGraph {
  const addEdge = (
    producer: FromNode,
    consumer: ToNode,
    trackingVersion: number
  ): void => {
    const tail = consumer._inTail;
    
    // Fast path: check if tail is the producer we want
    if (tail && tail.from === producer) {
      tail.trackingVersion = trackingVersion;
      return;
    }

    // Check the next candidate (either after tail or first edge)
    const candidate = tail ? tail.nextIn : consumer._in;
    
    if (candidate && candidate.from === producer) {
      candidate.trackingVersion = trackingVersion;
      consumer._inTail = candidate;
      return;
    }

    // No reusable edge found - create new edge
    const prevOut = producer._outTail;
    
    const newEdge = {
      from: producer,
      to: consumer,
      trackingVersion,
      touched: false,
      prevIn: tail,
      prevOut,
      nextIn: candidate,
      nextOut: undefined,
    };

    // Wire up consumer's input list
    if (candidate) candidate.prevIn = newEdge;
    if (tail) tail.nextIn = newEdge;
    else consumer._in = newEdge;
    consumer._inTail = newEdge;

    // Wire up producer's output list
    if (prevOut) prevOut.nextOut = newEdge;
    else producer._out = newEdge;
    producer._outTail = newEdge;
    
    // Set TRACKING flag if producer is also a consumer
    if ('_flags' in producer) producer._flags |= TRACKING;
  };

  // ALGORITHM: Full Bidirectional Edge Removal (alien-signals pattern)
  // Removes an edge from both producer and consumer lists in O(1)
  // Returns the next edge in consumer's list for easy iteration
  const removeEdge = (edge: Edge): Edge | undefined => {
    const from = edge.from;
    const to = edge.to;
    const prevIn = edge.prevIn;
    const nextIn = edge.nextIn;
    const prevOut = edge.prevOut;
    const nextOut = edge.nextOut;

    // Update consumer's input list
    if (nextIn) nextIn.prevIn = prevIn;
    else to._inTail = prevIn;

    if (prevIn) prevIn.nextIn = nextIn;
    else to._in = nextIn;

    // Update producer's output list
    if (nextOut) nextOut.prevOut = prevOut;
    else from._outTail = prevOut;

    if (prevOut) prevOut.nextOut = nextOut;
    else {
      from._out = nextOut;
      // Clear TRACKING flag if this was the last consumer
      // Use direct property access instead of 'in' operator for speed
      if (!nextOut && '_flags' in from) {
        from._flags &= ~TRACKING;
        // When a computed becomes unobserved, clear its dependencies
        // This is the "unobserved computed" optimization from alien-signals
        if ('_recompute' in from) {
          // Clear all dependency edges to free memory
          detachAll(from);
          // Mark as DIRTY so it recomputes fresh when re-observed
          from._flags |= DIRTY;
        }
      }
    }

    return nextIn;
  };

  // For computed nodes: check if dependencies changed and recompute if needed
  const isStale = (node: DerivedNode): boolean => {
    const flags = node._flags;

    // Fast path: already marked dirty
    if (flags & DIRTY) return true;

    let stack;
    let currentNode = node;
    let currentEdge = node._in;
    let stale = false;

    for (;;) {
      while (currentEdge) {
        const source = currentEdge.from;
        
        // Check if source is a derived node (computed)
        if ('_recompute' in source) {
          const sFlags = source._flags;

          // Early exit if source is dirty
          if (sFlags & DIRTY) {
            stale = true;
            currentEdge = currentEdge.nextIn;
            continue;
          }

          // Recurse into invalidated sources
          if (sFlags & INVALIDATED) {
            stack = {
              edge: currentEdge.nextIn,
              node: currentNode,
              stale,
              prev: stack,
            };
            currentNode = source;
            currentEdge = source._in;
            stale = false;
            continue;
          }
        }
        
        // Check touched flag after other checks for better branch prediction
        if (currentEdge.touched) {
          stale = true;
        }
        currentEdge.touched = false;
        currentEdge = currentEdge.nextIn;
      }

      // Process computed nodes in the traversal
      if (currentNode !== node) {
        stale = stale ? currentNode._recompute() : ((currentNode._flags &= ~INVALIDATED), false);
      }

      // Pop from stack or exit
      if (!stack) break;

      stale = stale || stack.stale;
      currentNode = stack.node;
      currentEdge = stack.edge;
      stack = stack.prev;
    }
    
    // Update flags
    node._flags = stale ? (flags | DIRTY) & ~INVALIDATED : flags & ~INVALIDATED;
    return stale;
  };

  // For effect nodes: check if any direct dependencies changed
  // Only checks immediate dependencies, not recursive traversal
  const needsFlush = (node: ScheduledNode): boolean => {
    const flags = node._flags;

    if (flags & DIRTY) return true;

    let needsRun = false;
    let edge = node._in;
    
    while (edge) {
      const source = edge.from;
      edge.touched = false;
      
      // Check if source changed - optimize for common case (signals)
      if (source._dirty) {
        needsRun = true;
      } else if ('_recompute' in source) {
        const sourceFlags = source._flags;
        // Consolidate flag checks for better branch prediction
        if (sourceFlags & DIRTY) {
          needsRun = true;
        } else if (!(sourceFlags & INVALIDATED)) {
          // Already evaluated and clean - no change
        } else {
          // Needs evaluation
          if (source._recompute()) needsRun = true;
        }
      }
      
      edge = edge.nextIn;
    }
    
    // Update flags once at the end
    node._flags = needsRun ? (flags | DIRTY) & ~INVALIDATED : flags & ~INVALIDATED;
    return needsRun;
  };

  // ALGORITHM: Complete Edge Removal
  // Used during disposal to remove all dependency edges at once
  const detachAll = (consumer: ConsumerNode): void => {
    let node = consumer._in;
    
    // Walk the linked list of sources
    while (node) {
      // removeEdge returns the next edge, so we can iterate efficiently
      node = removeEdge(node);
    }
    
    // Clear the consumer's source list head and tail
    consumer._in = undefined;
    consumer._inTail = undefined;
  };

  // ALGORITHM: Tail-based Edge Removal (alien-signals approach)
  // After a computed/effect runs, remove all edges after the tail marker.
  // The tail was set at the start of the run, and all valid dependencies
  // were moved to/before the tail during the run.
  const pruneStale = (consumer: ConsumerNode): void => {
    const tail = consumer._inTail;
    
    // If no tail, all edges should be removed
    let toRemove = tail ? tail.nextIn : consumer._in;
    
    // Remove all edges after the tail
    while (toRemove) {
      // removeEdge handles both sides and returns next edge
      toRemove = removeEdge(toRemove);
    }
    
    // Update tail to point to the last valid edge
    if (tail) tail.nextIn = undefined;
  };

  const invalidate = (
      from: Edge | undefined,
      visit: (node: ScheduledNode) => void
  ): void => {
    let stack: Stack<Edge> | undefined;
    let currentEdge: Edge | undefined = from;

    if (!currentEdge) return;
    
    do {
      const target = currentEdge.to;
      // Mark this edge as the cause of invalidation for this traversal
      currentEdge.touched = true;

      const targetFlags = target._flags;

      // Skip already processed nodes
      if (targetFlags & SKIP_FLAGS) {
        currentEdge = currentEdge.nextOut;
        continue;
      }

      // Mark as invalidated and schedule if needed
      target._flags = targetFlags | INVALIDATED;

      if ('_out' in target) {
        const firstChild = target._out;
        const nextSibling = currentEdge.nextOut;

        // Optimization: single path doesn't need stack
        if (firstChild && !nextSibling && !stack) {
          currentEdge = firstChild;
          continue;
        }

        if (nextSibling) stack = { value: nextSibling, prev: stack };

        currentEdge = firstChild;

        if (currentEdge) continue;
        if (!stack) break;

        currentEdge = stack.value;
        stack = stack.prev;
        continue;
      }

      if ('_nextScheduled' in target) visit(target);
      
      currentEdge = currentEdge.nextOut;
      if (!currentEdge && stack) {
        currentEdge = stack.value;
        stack = stack.prev;
      }
    } while (currentEdge);
  };

  return { addEdge, removeEdge, detachAll, pruneStale, isStale, needsFlush, invalidate };
}
