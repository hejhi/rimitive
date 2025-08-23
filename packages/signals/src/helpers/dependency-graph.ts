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
import type { ProducerNode, ConsumerNode, Edge, ToNode, FromNode } from '../types';

const { TRACKING, INVALIDATED, STALE } = CONSTANTS;

export interface DependencyGraph {
  link: (
    producer: ProducerNode,
    consumer: ConsumerNode,
    trackingVersion: number
  ) => void;
  unlink: (edge: Edge) => Edge | undefined;
  refreshConsumers: (consumer: ConsumerNode) => boolean;
}

// Stack frame for backward DFS - similar to graph-walker but for dependencies
interface DepStack {
  edge: Edge | undefined;
  node: ToNode;
  stale: boolean;
  prev: DepStack | undefined;
}

export function createDependencyGraph(): DependencyGraph {
  // ALIEN-STYLE OPTIMIZATION: O(1) link without linear search
  const link = (
    producer: FromNode,
    consumer: ToNode,
    trackingVersion: number
  ): void => {
    // FAST PATH: Check tail (most recently accessed dependency)
    const tail = consumer._inTail;

    if (tail !== undefined && tail.from === producer) {
      tail.trackingVersion = trackingVersion;
      return;
    }

    // FAST PATH: Check second most recent (2-element cache)
    const nextAfterTail = tail !== undefined ? tail.nextIn : consumer._in;

    if (nextAfterTail !== undefined && nextAfterTail.from === producer) {
      nextAfterTail.trackingVersion = trackingVersion;
      consumer._inTail = nextAfterTail;
      return;
    }

    // Instead of searching through all edges, we just create a new one.
    // This trades potential duplicate edges for guaranteed O(1) performance.
    // The duplicate edges will be cleaned up during unlinking.

    // Create new edge immediately - no searching
    const nextDep = tail !== undefined ? tail.nextIn : consumer._in;
    const prevOut = producer._outTail;

    const newEdge: Edge = {
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

    // Set TRACKING flag if producer is a computed node
    if ('_flags' in producer) producer._flags |= TRACKING;

    // Update producer's output list
    if (prevOut) prevOut.nextOut = newEdge;
    else producer._out = newEdge;

    producer._outTail = newEdge;
  };

  // ALGORITHM: Full Bidirectional Edge Removal (alien-signals pattern)
  // Removes an edge from both producer and consumer lists in O(1)
  // Returns the next edge in consumer's list for easy iteration
  const unlink = (edge: Edge): Edge | undefined => {
    const { from, to, prevIn, nextIn, prevOut, nextOut } = edge;
    
    // Remove from consumer's input list
    if (nextIn) nextIn.prevIn = prevIn;
    else to._inTail = prevIn;
    
    if (prevIn) prevIn.nextIn = nextIn;
    else to._in = nextIn;
    
    // Remove from producer's output list
    if (nextOut) nextOut.prevOut = prevOut;
    else from._outTail = prevOut;
    
    if (prevOut) prevOut.nextOut = nextOut;
    else {
      from._out = nextOut;
      // Clear TRACKING flag if this was the last consumer
      if (!nextOut && '_flags' in from) from._flags &= ~TRACKING;
    }
    
    return nextIn;
  };

  const refreshConsumers = (toNode: ToNode): boolean => {
    const flags = toNode._flags;

    // Fast path: already known-stale nodes remain stale
    if (flags & STALE) return true;

    let stack: DepStack | undefined;
    let currentNode: ToNode = toNode;
    let currentEdge: Edge | undefined = currentNode._in;
    let stale = false;

    // Iterative DFS over incoming edges; unwind to update computed nodes
    for (;;) {
      if (currentEdge) {
        const source = currentEdge.from;

        if ('_in' in source) {
          const sFlags = source._flags;

          // Child computed already stale: mark and continue
          if (sFlags & STALE) {
            stale = true;
            currentEdge = currentEdge.nextIn;
            continue;
          }

          // Child computed invalidated: descend to verify and potentially update
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

          // Otherwise, no need to propagate unless explicitly touched
          if (currentEdge.touched) stale = true;
          // Clear touch marker after considering
          currentEdge.touched = false;
          currentEdge = currentEdge.nextIn;
          continue;
        }

        // Source is a signal: propagate only if this edge was touched in push
        if (currentEdge.touched) stale = true;
        // Clear touch marker after considering
        currentEdge.touched = false;
        currentEdge = currentEdge.nextIn;
        continue;
      }

      // Finished this node's inputs: if not the root, update on demand
      if (currentNode !== toNode) {
        if (stale) {
          // Only propagate if the value actually changed
          stale = currentNode._updateValue();
        } else {
          // Clear INVALIDATED since dependencies didn’t cause a change
          currentNode._flags &= ~INVALIDATED;
        }
      }

      // Unwind
      if (!stack) break;
      const frame = stack;
      stack = frame.prev;
      // Merge staleness with parent frame’s pending state
      stale = stale || frame.stale;
      currentNode = frame.node;
      currentEdge = frame.edge;
    }

    // Update and return final state for the root
    toNode._flags = stale ? (flags | STALE) & ~INVALIDATED : flags & ~INVALIDATED;
    return stale;
  };

  return { link, unlink, refreshConsumers };
}
