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

const { INVALIDATED, DIRTY, DISPOSED, RUNNING, OBSERVED } = CONSTANTS;
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
  isStale: (node: DerivedNode) => boolean; // For derived nodes (deprecated, use checkAndUpdate)
  checkAndUpdate: (node: DerivedNode) => boolean; // Check staleness AND update computeds in one pass
  needsFlush: (node: ScheduledNode) => boolean; // For scheduled nodes
  
  // Invalidation strategies
  invalidate: (
    from: Edge | undefined,
    visit: (node: ScheduledNode) => void
  ) => void;
  shallowInvalidate: (
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
    if (prevOut) {
      prevOut.nextOut = newEdge;
    } else {
      producer._out = newEdge;
      // When adding first outgoing edge, mark producer as OBSERVED
      if ('_flags' in producer) {
        producer._flags |= OBSERVED;
      }
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
        from._flags &= ~OBSERVED;
        
        // When a computed becomes completely unobserved (no outgoing edges at all)
        // PRESERVE EDGES: Don't destroy dependency edges, keep them for reuse
        if ('_recompute' in from) {
          // Mark as DIRTY so it recomputes when re-observed
          // But DON'T call detachAll - preserve the edges for faster re-observation
          // This is the key to "preserved edges benefit"
          from._flags |= DIRTY;
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
  const isStale = (node: DerivedNode): boolean => {
    const flags = node._flags;

    // Fast path: already marked dirty
    if (flags & DIRTY) return true;
    
    // Prevent cycles
    if (flags & RUNNING) return false;

    // If no tail marker, the computed hasn't run yet or all edges are stale
    // In this case, we need to recompute
    if (!node._inTail && node._in) return true;

    interface StackFrame {
      edge: Edge | undefined;
      node: DerivedNode;
      stale: boolean;
      prev: StackFrame | undefined;
    }

    let stack: StackFrame | undefined;
    let currentNode = node;
    let currentEdge = node._in;
    let stale = false;
    
    // Mark as running to prevent cycles
    node._flags |= RUNNING;

    for (;;) {
      while (currentEdge) {
        // Stop at tail marker - don't check stale edges beyond tail
        if (currentNode._inTail && currentEdge === currentNode._inTail.nextIn) {
          currentEdge = undefined;
          break;
        }

        const source = currentEdge.from;

        // Check if source is a dirty signal
        if (source._dirty) {
          stale = true;
          // Early exit - no need to check remaining edges
          currentEdge = undefined;
          break;
        }

        // Check if source is a derived node (computed)
        if ('_recompute' in source) {
          const sFlags = source._flags;

          // Early exit if source is already marked dirty
          if (sFlags & DIRTY) {
            stale = true;
            currentEdge = undefined;
            break;
          }

          // If source has no tail, it needs recomputation
          if (!source._inTail && source._in) {
            stale = true;
            currentEdge = undefined;
            break;
          }

          // Recurse into computeds that haven't been checked yet
          // Skip if already running (cycle detection)
          if (!(sFlags & RUNNING)) {
            source._flags |= RUNNING;
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

      // Process computed nodes in the traversal
      // If we found staleness, mark the computed as dirty
      if (currentNode !== node && stale) {
        currentNode._flags |= DIRTY;
      }

      // Clear RUNNING flag as we pop back up
      if (currentNode !== node) {
        currentNode._flags &= ~RUNNING;
      }

      // Pop from stack or exit
      if (!stack) break;

      stale = stale || stack.stale;
      currentNode = stack.node;
      currentEdge = stack.edge;
      stack = stack.prev;
    }

    // Clear RUNNING flag from root node
    node._flags &= ~RUNNING;

    // Update flags based on result
    if (stale) {
      node._flags |= DIRTY;
    }
    
    return stale;
  };

  // For effect nodes: check if any dependencies changed (recursively)
  // Uses the same iterative approach as isStale for consistency
  const needsFlush = (node: ScheduledNode): boolean => {
    const flags = node._flags;

    // Fast path: already marked dirty
    if (flags & DIRTY) return true;
    
    // Prevent cycles
    if (flags & RUNNING) return false;

    // If no tail marker, the effect hasn't run yet or all edges are stale
    // In this case, we need to run it
    if (!node._inTail && node._in) return true;

    interface StackFrame {
      edge: Edge | undefined;
      node: ConsumerNode;
      stale: boolean;
      prev: StackFrame | undefined;
    }

    let stack: StackFrame | undefined;
    let currentNode: ConsumerNode = node;
    let currentEdge = node._in;
    let stale = false;
    
    // Mark as running to prevent cycles
    node._flags |= RUNNING;

    for (;;) {
      while (currentEdge) {
        // Stop at tail marker - don't check stale edges beyond tail
        if (currentNode._inTail && currentEdge === currentNode._inTail.nextIn) {
          currentEdge = undefined;
          break;
        }

        const source = currentEdge.from;

        // Check if source is a dirty signal
        if (source._dirty) {
          stale = true;
          // Early exit - no need to check remaining edges
          currentEdge = undefined;
          break;
        }

        // Check if source is a derived node (computed)
        if ('_recompute' in source) {
          const sFlags = source._flags;

          // Early exit if source is already marked dirty
          if (sFlags & DIRTY) {
            stale = true;
            currentEdge = undefined;
            break;
          }

          // If source has no tail, it needs recomputation
          if (!source._inTail && source._in) {
            stale = true;
            currentEdge = undefined;
            break;
          }

          // Recurse into computeds that haven't been checked yet
          // Skip if already running (cycle detection)
          if (!(sFlags & RUNNING)) {
            source._flags |= RUNNING;
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

      // Process computed nodes in the traversal
      // If we found staleness and this is a computed, recompute on the way back up
      if (currentNode !== node && stale && '_recompute' in currentNode) {
        stale = (currentNode as DerivedNode)._recompute();
      }

      // Clear RUNNING flag as we pop back up
      if (currentNode !== node) {
        currentNode._flags &= ~RUNNING;
      }

      // Pop from stack or exit
      if (!stack) break;

      stale = stale || stack.stale;
      currentNode = stack.node;
      currentEdge = stack.edge;
      stack = stack.prev;
    }

    // Clear RUNNING flag from root node
    node._flags &= ~RUNNING;

    // Update flags based on result
    if (stale) {
      node._flags |= DIRTY;
    }
    
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

      // Skip already processed nodes, already invalidated nodes, or unobserved nodes
      if (targetFlags & (SKIP_FLAGS | INVALIDATED)) {
        currentEdge = currentEdge.nextOut;
        continue;
      }


      // Mark as invalidated (push phase - might be stale)
      target._flags = targetFlags | INVALIDATED;

      // Handle producer nodes (have outputs)
      if ('_out' in target) {
        const firstChild = target._out;
        
        // Traverse through computeds that have consumers
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

  // Shallow invalidation for hybrid push-pull system
  // Only marks immediate consumers, not transitive dependents
  const shallowInvalidate = (
      from: Edge | undefined,
      visit: (node: ScheduledNode) => void
  ): void => {
    if (!from) return;
    
    let currentEdge: Edge | undefined = from;
    
    // Only process immediate consumers (one level deep)
    while (currentEdge) {
      const target = currentEdge.to;
      const targetFlags = target._flags;

      // Skip already processed nodes
      if (!(targetFlags & SKIP_FLAGS)) {
        // LAZY SUBSCRIPTION: Only mark observed computeds as dirty
        // Unobserved computeds will be recomputed when re-observed
        const isUnobservedComputed = '_recompute' in target && !target._out;
        
        if (!isUnobservedComputed) {
          // Mark as dirty
          target._flags = targetFlags | DIRTY;
          
          // Schedule effects (computeds don't get scheduled directly)
          if ('_nextScheduled' in target) {
            visit(target);
          }
        }
        // Unobserved computeds are skipped entirely - they'll recompute when needed
      }

      currentEdge = currentEdge.nextOut;
    }
  };


  // Check staleness AND update computeds during traversal (alien-signals approach)
  // This combines checking and updating in one pass for better performance
  const checkAndUpdate = (node: DerivedNode): boolean => {
    const flags = node._flags;

    // Fast path: already marked dirty
    if (flags & DIRTY) return true;
    
    // Prevent cycles
    if (flags & RUNNING) return false;

    // If no tail marker, the computed hasn't run yet or all edges are stale
    if (!node._inTail && node._in) return true;

    interface StackFrame {
      edge: Edge | undefined;
      node: DerivedNode;
      stale: boolean;
      prev: StackFrame | undefined;
    }

    let stack: StackFrame | undefined;
    let currentNode = node;
    let currentEdge = node._in;
    let stale = false;
    
    // Mark as running to prevent cycles
    node._flags |= RUNNING;

    for (;;) {
      while (currentEdge) {
        // Stop at tail marker - don't check stale edges beyond tail
        if (currentNode._inTail && currentEdge === currentNode._inTail.nextIn) {
          currentEdge = undefined;
          break;
        }

        const source = currentEdge.from;

        // Check if source is a dirty signal
        if (source._dirty) {
          stale = true;
          currentEdge = undefined;
          break;
        }

        // Check if source is a derived node (computed)
        if ('_recompute' in source) {
          const sFlags = source._flags;

          // Early exit if source is already marked dirty
          if (sFlags & DIRTY) {
            stale = true;
            currentEdge = undefined;
            break;
          }

          // If source has no tail, it needs recomputation
          if (!source._inTail && source._in) {
            stale = true;
            currentEdge = undefined;
            break;
          }

          // Recurse into computeds that haven't been checked yet
          // Skip if already running (cycle detection)
          if (!(sFlags & RUNNING)) {
            source._flags |= RUNNING;
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

      // KEY DIFFERENCE: Update computeds during traversal (like alien-signals)
      // This avoids the need for a separate recomputation pass
      if (currentNode !== node && stale) {
        // Recompute the intermediate computed immediately
        const changed = currentNode._recompute();
        // Propagate the change status up
        stale = changed;
      }

      // Clear RUNNING flag as we pop back up
      if (currentNode !== node) {
        currentNode._flags &= ~RUNNING;
      }

      // Pop from stack or exit
      if (!stack) break;

      stale = stale || stack.stale;
      currentNode = stack.node;
      currentEdge = stack.edge;
      stack = stack.prev;
    }

    // Clear RUNNING flag from root node
    node._flags &= ~RUNNING;

    // The root node's staleness is determined by whether any dependencies changed
    return stale;
  };

  return { addEdge, removeEdge, detachAll, pruneStale, isStale, checkAndUpdate, needsFlush, invalidate, shallowInvalidate };
}
