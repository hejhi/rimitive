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

const { TRACKING, INVALIDATED, STALE, PENDING } = CONSTANTS;

export interface DependencyGraph {
  link: (
    producer: ProducerNode,
    consumer: ConsumerNode,
    trackingVersion: number
  ) => void;
  unlink: (edge: Edge) => Edge | undefined;
  refreshConsumers: (consumer: ConsumerNode) => boolean;
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

    // ALIEN OPTIMIZATION: NO LINEAR SEARCH!
    // Instead of searching through all edges, we just create a new one.
    // This trades potential duplicate edges for guaranteed O(1) performance.
    // The duplicate edges will be cleaned up during unlinking.

    // Create new edge immediately - no searching
    const nextDep = tail !== undefined ? tail.nextIn : consumer._in;
    const prevOut = producer._outTail;

    const newEdge: Edge = {
      from: producer,
      to: consumer,
      trackingVersion: trackingVersion,
      prevIn: tail,
      prevOut,
      nextIn: nextDep,
      nextOut: undefined,
    };

    // Update consumer's input list
    if (nextDep) nextDep.prevIn = newEdge;

    if (tail) {
      tail.nextIn = newEdge;
    } else {
      consumer._in = newEdge;
    }

    consumer._inTail = newEdge;

    // Set TRACKING flag if producer is a computed node
    if ('_flags' in producer) producer._flags |= TRACKING;

    // Update producer's output list
    if (prevOut) {
      prevOut.nextOut = newEdge;
    } else {
      producer._out = newEdge;
    }

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
    
    if (prevOut) {
      prevOut.nextOut = nextOut;
    } else {
      from._out = nextOut;
      // Clear TRACKING flag if this was the last consumer
      if (!nextOut && '_flags' in from) (from._flags &= ~TRACKING);
    }
    
    return nextIn;
  };


  // V8 OPTIMIZATION: Streamlined dependency checking with corrected logic
  const refreshConsumers = (toNode: ToNode): boolean => {
    const flags = toNode._flags;
    
    // V8 OPTIMIZATION: Early exits with predictable branches
    // Remove the INVALIDATED check - we're only called when INVALIDATED
    if (flags & STALE) return true;

    // Stack frame for backward DFS - similar to graph-walker but for dependencies
    interface DepStack {
      edge: Edge | undefined;
      node: ToNode;
      stale: boolean;
      prev: DepStack | undefined;
    }

    let stack: DepStack | undefined;
    let currentEdge: Edge | undefined = toNode._in;
    let currentNode = toNode;
    let stale = false;

    // Single do-while loop following DFS pattern
    do {
      if (currentEdge) {
        // Skip recycled edges
        if (currentEdge.trackingVersion === -1) {
          currentEdge = currentEdge.nextIn;
          continue;
        }

        const source = currentEdge.from;
        const wasDirty = source._dirty;
        
        // Check if we need to recurse into this dependency
        if ('_in' in source) {
          // Computed node
          const sourceFlags = source._flags;
          
          if (sourceFlags & STALE) {
            stale = true;
            currentEdge = currentEdge.nextIn;
          } else if (wasDirty || sourceFlags & PENDING) {
            if (sourceFlags & INVALIDATED) {
              // Save current position and descend into dependency
              stack = { 
                edge: currentEdge.nextIn, 
                node: currentNode, 
                stale, 
                prev: stack 
              };
              
              // Descend into the dependency
              currentNode = source;
              currentEdge = source._in;
              stale = false;
              continue;
            }
            stale = true;
            currentEdge = currentEdge.nextIn;
          } else {
            currentEdge = currentEdge.nextIn;
          }
        } else {
          // Signal node - just check dirty flag
          stale = stale || wasDirty;
          currentEdge = currentEdge.nextIn;
        }
      } else {
        // No more edges for current node - time to process and unwind
        
        // Update node if stale (but not the root node yet)
        if (stale && currentNode !== toNode) {
          currentNode._updateValue();
          // After updating, check if node is still dirty
          stale = '_dirty' in currentNode ? currentNode._dirty : false;
        }
        
        // Clear INVALIDATED flag if not stale
        if (!stale) {
          currentNode._flags &= ~INVALIDATED;
        }

        // Pop from stack
        if (!stack) break;
        
        const frame = stack;
        currentEdge = frame.edge;
        currentNode = frame.node;
        // Combine staleness: current stale OR parent was already stale
        stale = stale || frame.stale;
        stack = frame.prev;
      }
    } while (true);

    // Update final flags for the original node
    toNode._flags = stale ? (flags | STALE) & ~INVALIDATED : flags & ~INVALIDATED;
    return stale;
  };

  return { link, unlink, refreshConsumers };
}
