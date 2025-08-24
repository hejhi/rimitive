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

const { TRACKING, DIRTY, DISPOSED, RUNNING } = CONSTANTS;
const SKIP_FLAGS = DISPOSED | RUNNING;


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

    // Third check (alien-signals optimization): Check producer's tail subscriber
    // If the producer already has this consumer as its tail with current version, skip
    // This happens when the same consumer reads the same producer multiple times in one run
    const producerTail = producer._outTail;
    if (producerTail && producerTail.to === consumer && producerTail.trackingVersion === trackingVersion) {
      // Edge already exists with current version - it was created earlier in this run
      // No need to update anything, it's already properly positioned
      return;
    }

    // No reusable edge found - create new edge
    const prevOut = producer._outTail;
    
    const newEdge = {
      from: producer,
      to: consumer,
      trackingVersion,
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
    // Fast path: already marked dirty
    if (node._flags & DIRTY) return true;

    // Check all direct dependencies
    let edge = node._in;
    while (edge) {
      const source = edge.from;
      
      // Check if source is dirty
      if (source._dirty) {
        node._flags |= DIRTY;
        return true;
      }
      
      // Check if source is a derived node (computed) that's dirty
      if ('_recompute' in source && source._flags & DIRTY) {
        node._flags |= DIRTY;
        return true;
      }
      
      edge = edge.nextIn;
    }
    
    return false;
  };

  // For effect nodes: check if any direct dependencies changed
  // Only checks immediate dependencies, not recursive traversal
  const needsFlush = (node: ScheduledNode): boolean => {
    if (node._flags & DIRTY) return true;

    let edge = node._in;
    while (edge) {
      const source = edge.from;
      
      // Check if source changed - optimize for common case (signals)
      if (source._dirty) {
        node._flags |= DIRTY;
        return true;
      } 
      
      // Check if source is a derived node (computed) that's dirty
      if ('_recompute' in source && source._flags & DIRTY) {
        node._flags |= DIRTY;
        return true;
      }
      
      edge = edge.nextIn;
    }
    
    return false;
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

  interface Stack<T> {
    value: T;
    prev: Stack<T> | undefined;
  }

  const invalidate = (
      from: Edge | undefined,
      visit: (node: ScheduledNode) => void
  ): void => {
    if (!from) return;
    
    let stack: Stack<Edge> | undefined;
    let currentEdge: Edge | undefined = from;
    
    do {
      const target = currentEdge.to;

      const targetFlags = target._flags;

      // Skip already processed nodes or already dirty nodes
      if (targetFlags & (SKIP_FLAGS | DIRTY)) {
        currentEdge = currentEdge.nextOut;
        continue;
      }

      // Mark as dirty (using DIRTY instead of INVALIDATED)
      target._flags = targetFlags | DIRTY;

      // Handle producer nodes (have outputs)
      if ('_out' in target) {
        const firstChild = target._out;
        
        if (firstChild) {
          const nextSibling = currentEdge.nextOut;
          
          // Push sibling to stack if exists
          if (nextSibling) {
            stack = { value: nextSibling, prev: stack };
          }
          
          // Continue with first child
          currentEdge = firstChild;
          continue;
        }
      } else if ('_nextScheduled' in target) {
        // Effect node - schedule it
        visit(target);
      }
      
      // Move to next sibling or pop from stack
      currentEdge = currentEdge.nextOut;
      while (!currentEdge && stack) {
        currentEdge = stack.value;
        stack = stack.prev;
      }
    } while (currentEdge);
  };

  return { addEdge, removeEdge, detachAll, pruneStale, isStale, needsFlush, invalidate };
}
