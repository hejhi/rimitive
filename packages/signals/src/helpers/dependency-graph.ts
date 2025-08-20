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
import type { ProducerNode, ConsumerNode, Edge, ToNode } from '../types';

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

// Stack frame type - follows Alien's pattern, never mutates Edge
interface StackFrame {
  edge: Edge;
  next: Edge | undefined;
  to: ToNode;
  stale: boolean;
  prev: StackFrame | undefined;
}

export function createDependencyGraph(): DependencyGraph {
  // ALIEN-STYLE OPTIMIZATION: O(1) link without linear search
  const link = (
    producer: ProducerNode,
    consumer: ConsumerNode,
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
    const prevDep = tail;
    const nextDep = tail !== undefined ? tail.nextIn : consumer._in;
    const prevOut = producer._outTail;

    const newEdge: Edge = {
      from: producer,
      to: consumer,
      trackingVersion: trackingVersion,
      prevIn: prevDep,
      prevOut,
      nextIn: nextDep,
      nextOut: undefined,
    };

    // Update consumer's input list
    if (nextDep) nextDep.prevIn = newEdge;
    if (prevDep) {
      prevDep.nextIn = newEdge;
    } else {
      consumer._in = newEdge;
    }
    consumer._inTail = newEdge;

    // Set TRACKING flag if producer is a computed node
    if ('_flags' in producer)
      (producer as ProducerNode & ConsumerNode)._flags |= TRACKING;

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
      if (!nextOut && '_flags' in from) {
        from._flags &= ~TRACKING;
      }
    }
    
    return nextIn;
  };

  // V8 OPTIMIZATION: Streamlined dependency checking with corrected logic
  const refreshConsumers = (toNode: ToNode): boolean => {
    const flags = toNode._flags;
    
    // V8 OPTIMIZATION: Early exits with predictable branches
    // Remove the INVALIDATED check - we're only called when INVALIDATED
    if (flags & STALE) return true;

    let node = toNode;
    let edge = toNode._in;
    let stack: StackFrame | undefined;
    let stale = false;

    // V8 OPTIMIZATION: Reduce loop overhead with while(true) pattern
    while (true) {
      // Process all edges for current node
      while (edge) {
        // Skip recycled edges (using -1 as sentinel in trackingVersion)
        if (edge.trackingVersion === -1) {
          edge = edge.nextIn;
          continue;
        }

        const source = edge.from;
        const wasDirty = source._dirty;
        
        // DON'T clear dirty flag here - multiple consumers may need to see it
        
        // Branch on node type for better prediction (preserved original logic)
        if ('_in' in source) {
          // Computed node
          const sourceFlags = source._flags;
          console.log('DEBUG: Checking computed source, wasDirty =', wasDirty, 'flags =', sourceFlags);
          
          if (sourceFlags & STALE) {
            stale = true;
            console.log('DEBUG: Computed source is STALE');
          } else if (wasDirty || (sourceFlags & PENDING)) {
            if (sourceFlags & INVALIDATED) {
              // Push to stack and recurse
              console.log('DEBUG: Computed source INVALIDATED, recursing');
              stack = { edge, next: edge.nextIn, to: node, stale, prev: stack };
              node = source;
              edge = source._in;
              stale = false;
              continue;
            }
            stale = true;
            console.log('DEBUG: Computed source dirty/pending, marking stale');
          }
        } else {
          // Signal node - check dirty flag
          console.log('DEBUG: Checking signal source, wasDirty =', wasDirty);
          stale = stale || wasDirty;
        }
        
        edge = edge.nextIn;
      }

      // Process current node
      if (!stale) {
        node._flags &= ~INVALIDATED;
      }
      
      if (!stack) break;

      // Stack unwind (preserved original logic)
      const frame = stack;
      if (stale) {
        node._updateValue();
        // After updating, check if node is still dirty (for producer nodes)
        stale = '_dirty' in node ? node._dirty : false;
      }

      edge = frame.next;
      node = frame.to;
      stack = frame.prev;
      stale = frame.stale || stale;
    }

    // Update final flags
    toNode._flags = stale ? (flags | STALE) & ~INVALIDATED : flags & ~INVALIDATED;
    return stale;
  };

  return {
    link,
    unlink,
    refreshConsumers,
  };
}
