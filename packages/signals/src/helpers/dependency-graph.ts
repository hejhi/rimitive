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
import type { ProducerNode, ConsumerNode, Edge, ToNode, FromNode, ScheduledNode, DerivedNode } from '../types';

const { 
  CLEAN, INVALIDATED, DIRTY, CHECKING, RECOMPUTING, 
  VALUE_CHANGED, UPDATE_NEEDED, IN_PROGRESS, SKIP_NODE,
  STATE_MASK, PROPERTY_MASK
} = CONSTANTS;

// Nodes that should be skipped during traversal (disposed or currently processing)
const ALREADY_HANDLED = SKIP_NODE | INVALIDATED;

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

export interface DependencyGraph {
  // Edge management
  addEdge: (
    producer: ProducerNode,
    consumer: ConsumerNode
  ) => void;
  removeEdge: (edge: Edge) => Edge | undefined;

  // Cleanup operations
  detachAll: (consumer: ConsumerNode) => void;
  pruneStale: (consumer: ConsumerNode) => void;

  // Staleness checks
  checkStale: (node: ToNode) => void; // Single-pass update of entire dependency chain

  // Invalidation strategies
  invalidate: (
    from: Edge | undefined,
    visit: (node: ScheduledNode) => void
  ) => void;
}

export function createDependencyGraph(): DependencyGraph {
  const addEdge = (
    producer: FromNode,
    consumer: ToNode
  ): void => {
    const tail = consumer._inTail;

    // Fast path: check if tail is the producer we want
    // Edge already at tail, skipping
    if (tail && tail.from === producer) return;

    // Check the next candidate (either after tail or first edge)
    const candidate = tail ? tail.nextIn : consumer._in;

    if (candidate && candidate.from === producer) {
      // Edge found as candidate, moving to tail
      consumer._inTail = candidate;
      return;
    }
    
    // Cache previous out tail
    const prevOut = producer._outTail;

    const newEdge = {
      from: producer,
      to: consumer,
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
  };

  // Full Bidirectional Edge Removal
  // Removes an edge from both producer and consumer lists in O(1)
  // Returns the next edge in consumer's list for easy iteration
  const removeEdge = (edge: Edge): Edge | undefined => {
    const { from, to, prevIn, nextIn, prevOut, nextOut } = edge;

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
      // When a computed becomes completely unobserved, transition to DIRTY state
      if (!nextOut && isDerived(from)) from._flags = (from._flags & PROPERTY_MASK) | DIRTY;
    }

    return nextIn;
  };

  // Helper: Check if source is a computed
  const isDerived = (source: FromNode | ToNode): source is DerivedNode => '_recompute' in source;

  // ALGORITHM: Complete Edge Removal  
  // Used during disposal to remove all dependency edges at once
  const detachAll = (consumer: ConsumerNode): void => {
    let edge = consumer._in;
    
    // Complete removal - remove all edges
    if (edge) {
      do {
        edge = removeEdge(edge);
      } while (edge);
    }
    
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
    if (toRemove) {
      do {
        toRemove = removeEdge(toRemove);
      } while (toRemove);
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

      // Skip nodes that are disposed, in progress, or already invalidated
      if (targetFlags & ALREADY_HANDLED) {
        currentEdge = currentEdge.nextOut;
        continue;
      }

      // Transition to invalidated state (push phase - might be stale)
      // Use cached flags to avoid double read in hot path
      target._flags = (targetFlags & PROPERTY_MASK) | INVALIDATED;

      // Handle producer nodes (have outputs)
      if ('_out' in target) {
        const firstChild = target._out;
        // Check if producer has outputs

        // Only traverse into observed computeds to avoid invalidating unneeded subgraphs
        // Skip unobserved computeds but still invalidate them
        if (firstChild && target._out) {
          const nextSibling = currentEdge.nextOut;

          // Push sibling to stack if exists
          if (nextSibling) stack = { value: nextSibling, prev: stack };

          // Continue with first child
          currentEdge = firstChild;
          continue;
        }
        // Effect node - schedule it
      } else if ('_nextScheduled' in target) visit(target);

      // Move to next sibling or pop from stack
      currentEdge = currentEdge.nextOut;

      if (currentEdge || !stack) continue;

      // Backtrack through multiple completed levels when unwinding the stack
      while (!currentEdge && stack) {
        currentEdge = stack.value;
        stack = stack.prev;
      }
    } while (currentEdge);
  };

  // ALGORITHM: Single-Pass Staleness Check and Update
  // Similar to Alien's checkDirty, this traverses the dependency graph once
  // and updates ALL computeds in the chain, including the root node.
  // This prevents redundant isStale() calls during recomputation.
  // ASSUMES: Caller has already checked that node has DIRTY or INVALIDATED flags
  const checkStale = (node: ToNode): void => {
    const flags = node._flags;
    
    // For DIRTY nodes, transition to recomputing and update directly
    if ((flags & STATE_MASK) === DIRTY) {
      node._flags = (flags & PROPERTY_MASK) | RECOMPUTING;
      if ('_recompute' in node) (node as DerivedNode)._recompute();
      node._flags = (node._flags & PROPERTY_MASK) | CLEAN;
      return;
    }
    
    // For INVALIDATED nodes, transition to checking state
    node._flags = (flags & PROPERTY_MASK) | CHECKING;

    // At this point, we know the node is INVALIDATED (not DIRTY)
    // Do a modified isStale that updates the chain
    // Modified isStale logic that updates dependencies during traversal
    let stack: Stack<Edge> | undefined;
    let currentNode = node;
    let currentEdge = node._in;
    let stale = false;

    for (;;) {
      while (currentEdge) {
        const source = currentEdge.from;
        const sFlags = source._flags;

        // Check if source is a dirty signal (has VALUE_CHANGED property)
        if (sFlags & VALUE_CHANGED) {
          stale = true;
          break;
        }

        const nextEdge = currentEdge.nextIn;

        // Inline isDerived check - check if source has _recompute method
        if (!('_recompute' in source)) {
          currentEdge = nextEdge;
          continue;
        }
        
        // If source needs update (DIRTY or INVALIDATED), traverse into it
        if (sFlags & UPDATE_NEEDED) {
          // Prevent cycles - skip if already checking or recomputing
          if (sFlags & IN_PROGRESS) {
            currentEdge = nextEdge;
            continue;
          }

          // Transition source to checking state
          source._flags = (sFlags & PROPERTY_MASK) | CHECKING;
          
          // Store current position if we have siblings to process
          if (nextEdge) {
            if (!stack) stack = { value: nextEdge, prev: undefined };
            else stack = { value: nextEdge, prev: stack };
          }
          
          // Traverse into the source to check its dependencies
          currentNode = source;
          currentEdge = source._in;
          continue;
        }
        
        currentEdge = nextEdge;
      }

      // Done with current node's dependencies
      // If this isn't the root node and it needs update, recompute it
      if (currentNode !== node && ('_recompute' in currentNode)) {
        const currentFlags = currentNode._flags;
        
        // If node was DIRTY or dependencies changed (stale), recompute it
        if ((currentFlags & STATE_MASK) === DIRTY || stale) {
          // Transition to recomputing state
          currentNode._flags = (currentFlags & PROPERTY_MASK) | RECOMPUTING;
          currentNode._recompute();
          // Check if value changed (VALUE_CHANGED property)
          stale = !!(currentNode._flags & VALUE_CHANGED);
        }
        
        // Transition back to clean state after processing
        currentNode._flags = (currentNode._flags & PROPERTY_MASK) | CLEAN;
      }
      
      // Pop from stack or break
      if (!stack || stale) break;
      
      currentEdge = stack.value;
      currentNode = currentEdge.to;
      stack = stack.prev;
    }

    // If stale, transition to recomputing and recompute the root node
    if (stale && ('_recompute' in node)) {
      node._flags = (node._flags & PROPERTY_MASK) | RECOMPUTING;
      (node as DerivedNode)._recompute();
    }
    
    // Transition root node back to clean state
    node._flags = (node._flags & PROPERTY_MASK) | CLEAN;
  };

  return { addEdge, removeEdge, detachAll, pruneStale, checkStale, invalidate };
}
