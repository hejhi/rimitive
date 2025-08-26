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
import type { ProducerNode, ConsumerNode, Edge, ToNode, FromNode, ScheduledNode } from '../types';

const { INVALIDATED, DIRTY, DISPOSED, RUNNING, OBSERVED, PRODUCER_DIRTY } = CONSTANTS;
const SKIP_FLAGS = DISPOSED | RUNNING;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

interface StackFrame {
  edge: Edge | undefined;
  node: ToNode;
  stale: boolean;
  prev: StackFrame | undefined;
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
  isStale: (node: ToNode) => boolean; // Check staleness and update computeds in one pass

  // Invalidation strategies
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

    // ADAPTIVE: Only check for duplicates if producer is shared (has 2+ outputs)
    // For simple patterns with no sharing, skip the third check entirely
    if (producer._out && producer._out.nextOut) {
      // Producer has multiple outputs - check for duplicate
      const producerTail = producer._outTail;

      // Edge already exists with current version - it was created earlier in this run
      // No need to update anything, it's already properly positioned
      if (
        producerTail && producerTail.to === consumer
        && producerTail.trackingVersion === trackingVersion
      ) return;
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
    else {
      producer._out = newEdge;
      // When adding first outgoing edge, mark producer as OBSERVED
      if ('_flags' in producer) producer._flags = producer._flags | OBSERVED;
    }

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
      if (!nextOut && '_flags' in from) {
        // When removing last outgoing edge, clear OBSERVED flag
        from._flags = from._flags & ~OBSERVED;
        
        // When a computed becomes completely unobserved (no outgoing edges at all)
        // PRESERVE EDGES: Don't destroy dependency edges, keep them for reuse
        if ('_recompute' in from) {
          // Mark as DIRTY so it recomputes when re-observed
          // But DON'T call detachAll - preserve the edges for faster re-observation
          from._flags = from._flags | DIRTY;
          // Note: We're keeping edges intact. This uses more memory but provides
          // much better performance when computeds are repeatedly observed/unobserved
        }
      }
    }

    return nextIn;
  };

  // For computed nodes: iteratively check if any dependencies changed
  // Uses manual stack to avoid function call overhead (like Alien Signals)
  // This combines checking and updating in one pass for efficiency
  const isStale = (node: ToNode): boolean => {
    const flags = node._flags;

    // Prevent cycles
    if (flags & RUNNING) return false;

    // If no tail marker, the computed hasn't run yet or all edges are stale
    // In this case, we need to recompute
    if ((!node._inTail && node._in) || flags & DIRTY) return true;

    let stack: StackFrame | undefined;
    let currentNode = node;
    let currentEdge = node._in;
    let stale = false;
    
    // Mark as running to prevent cycles
    node._flags = node._flags | RUNNING;

    for (;;) {
      while (currentEdge) {
        // Stop at tail marker - don't check stale edges beyond tail
        if (currentNode._inTail && currentEdge === currentNode._inTail.nextIn) break;

        const source = currentEdge.from;
        const sFlags = source._flags;

        // Check if source is a dirty signal
        if (sFlags & PRODUCER_DIRTY) {
          stale = true;
          break;
        }

        // Check if source is a derived node
        if ('_recompute' in source) {
          // Early exit if source is already marked dirty or needs recomputation
          if ((sFlags & DIRTY) || (!source._inTail && source._in)) {
            stale = true;
            break;
          }

          // Recurse into computeds that haven't been checked yet
          // Skip if already running (cycle detection)
          if (!(sFlags & RUNNING)) {
            source._flags = source._flags | RUNNING;
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

        currentEdge = currentEdge.nextIn;
      }

      // Update computeds during traversal
      // This avoids the need for a separate recomputation pass
      if (currentNode !== node) {
        if (stale && '_recompute' in currentNode) stale = currentNode._recompute();
        currentNode._flags = currentNode._flags & ~RUNNING;
      }

      // Pop from stack or exit
      if (!stack) break;

      stale = stale || stack.stale;
      currentNode = stack.node;
      currentEdge = stack.edge;
      stack = stack.prev;
    }

    // Clear RUNNING flag from root node
    node._flags = node._flags & ~RUNNING;
    return stale;
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

  // ALGORITHM: Bidirectional Stale Edge Removal (alien-signals approach)
  // After a computed/effect runs, remove all edges after the tail marker.
  // The tail was set at the start of the run, and all valid dependencies
  // were moved to/before the tail during the run.
  // Unlike the previous implementation, this completely removes stale edges
  // from BOTH the consumer's input list AND the producer's output list.
  const pruneStale = (consumer: ConsumerNode): void => {
    const tail = consumer._inTail;
    
    // If no tail, all edges should be removed
    let toRemove = tail ? tail.nextIn : consumer._in;
    
    // Remove all stale edges from both consumer and producer sides
    // This eliminates the need for edge validity checks during propagation
    while (toRemove) {
      // removeEdge handles bidirectional removal and returns next edge
      toRemove = removeEdge(toRemove);
    }
    
    // Update tail to point to the last valid edge
    if (tail) tail.nextIn = undefined;
  };

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

      // Skip already processed nodes or already invalidated nodes
      if (targetFlags & (SKIP_FLAGS | INVALIDATED)) {
        currentEdge = currentEdge.nextOut;
        continue;
      }


      // Mark as invalidated (push phase - might be stale)
      target._flags = targetFlags | INVALIDATED;

      // Handle producer nodes (have outputs)
      if ('_out' in target) {
        const firstChild = target._out;
        
        // Only traverse into observed computeds to avoid invalidating unneeded subgraphs  
        // Skip unobserved computeds but still invalidate them
        if (firstChild && (target._flags & OBSERVED)) {
          const nextSibling = currentEdge.nextOut;
          
          // Push sibling to stack if exists
          if (nextSibling) {
            stack = { value: nextSibling, prev: stack };
          }
          
          // Continue with first child
          currentEdge = firstChild;
          continue;
        }
        // Effect node - schedule it
      } else if ('_nextScheduled' in target) visit(target);
      
      // Move to next sibling or pop from stack
      currentEdge = currentEdge.nextOut;

      if (!currentEdge && stack) {
        do {
          currentEdge = stack.value;
          stack = stack.prev;
        } while (!currentEdge && stack);
      }
    } while (currentEdge);
  };

  return { addEdge, removeEdge, detachAll, pruneStale, isStale, invalidate };
}
