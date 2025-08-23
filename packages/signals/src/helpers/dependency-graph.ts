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

const { TRACKING, INVALIDATED, STALE } = CONSTANTS;

export interface DependencyGraph {
  addEdge: (
    producer: ProducerNode,
    consumer: ConsumerNode,
    trackingVersion: number
  ) => void;
  removeEdge: (edge: Edge) => Edge | undefined;
  isStale: (node: DerivedNode) => boolean;  // For computed nodes
  needsFlush: (node: ScheduledNode) => boolean;  // For effect nodes
}

export function createDependencyGraph(): DependencyGraph {
  const addEdge = (
    producer: FromNode,
    consumer: ToNode,
    trackingVersion: number
  ): void => {
    const tail = consumer._inTail;
    const inVal = consumer._in;

    if (tail && tail.from === producer) {
      tail.trackingVersion = trackingVersion;
      return;
    }

    const candidate = tail ? tail.nextIn : inVal;

    if (candidate && candidate.from === producer) {
      candidate.trackingVersion = trackingVersion;
      consumer._inTail = candidate;
      return;
    }

    // At this point, no reusable edge found; prepare new edge.
    const nextDep = candidate; // already determined
    const prevOut = producer._outTail;

    const newEdge = {
      from: producer,
      to: consumer,
      trackingVersion,
      touched: false,
      prevIn: tail,
      prevOut,
      nextIn: nextDep,
      nextOut: undefined,
    };

    // Update consumer's input list
    if (nextDep) nextDep.prevIn = newEdge;

    if (tail) tail.nextIn = newEdge;
    else consumer._in = newEdge;

    consumer._inTail = newEdge;

    // Set TRACKING flag if producer is also consumer
    if ('_flags' in producer) producer._flags |= TRACKING;

    // Update producer's output list
    if (prevOut) prevOut.nextOut = newEdge;
    else producer._out = newEdge;

    producer._outTail = newEdge;
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
      if (!nextOut && '_flags' in from) from._flags &= ~TRACKING;
    }

    return nextIn;
  };

  // For computed nodes: check if dependencies changed and recompute if needed
  const isStale = (node: DerivedNode): boolean => {
    const flags = node._flags;

    if (flags & STALE) return true;

    let stack;
    let currentNode: DerivedNode | ConsumerNode = node;
    let currentEdge = node._in;
    let stale = false;

    for (;;) {
      while (currentEdge) {
        const source = currentEdge.from;
        // Check if source is also a derived node (computed)
        if ('_in' in source) {
          const sFlags = source._flags;

          if (sFlags & STALE) {
            stale = true;
            currentEdge = currentEdge.nextIn;
            continue;
          }

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

          if (currentEdge.touched) stale = true;

          currentEdge.touched = false;
          currentEdge = currentEdge.nextIn;
          continue;
        } else {
          // Signal node - check if touched
          if (currentEdge.touched) stale = true;
          currentEdge.touched = false;
          currentEdge = currentEdge.nextIn;
          continue;
        }
      }

      // Process computed nodes in the traversal
      if (currentNode !== node && '_recompute' in currentNode) {
        stale = stale ? currentNode._recompute() : ((currentNode._flags &= ~INVALIDATED), false);
      }

      if (!stack) break;

      stale = stale || stack.stale;
      currentNode = stack.node;
      currentEdge = stack.edge;
      stack = stack.prev;
    }
    
    // Update flags
    node._flags = stale ? (flags | STALE) & ~INVALIDATED : flags & ~INVALIDATED;
    return stale;
  };

  // For effect nodes: check if any direct dependencies changed
  // Only checks immediate dependencies, not recursive traversal
  const needsFlush = (node: ScheduledNode): boolean => {
    const flags = node._flags;

    if (flags & STALE) return true;

    let needsRun = false;
    let edge = node._in;
    
    while (edge) {
      const source = edge.from;
      
      // Clear touched flag
      edge.touched = false;
      
      // Check if source changed
      if (source._dirty) {
        // Signal is dirty
        needsRun = true;
      } else if ('_recompute' in source && '_flags' in source) {
        // It's a DerivedNode (computed)
        const derivedSource = source as DerivedNode;
        if (derivedSource._flags & (INVALIDATED | STALE)) {
          // Let the computed handle its own recursive checking
          if (derivedSource._recompute()) {
            needsRun = true;
          }
        }
      }
      
      edge = edge.nextIn;
    }
    
    // Update flags
    node._flags = needsRun ? (flags | STALE) & ~INVALIDATED : flags & ~INVALIDATED;
    return needsRun;
  };

  return { addEdge, removeEdge, isStale, needsFlush };
}
