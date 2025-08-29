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

const { INVALIDATED, DIRTY, DISPOSED, RUNNING, VALUE_CHANGED, CONSUMED } = CONSTANTS;
const SKIP_FLAGS = DISPOSED | RUNNING;
const ALREADY_HANDLED = SKIP_FLAGS | INVALIDATED;

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
    consumer: ConsumerNode
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
    
    // PATTERN DETECTION: Mark producer as CONSUMED if consumer is a computed
    // This indicates the producer is part of a computed chain
    if (isDerived(consumer) && isDerived(producer)) {
      producer._flags |= CONSUMED;
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
      // When a computed becomes completely unobserved, mark as DIRTY
      if (!nextOut && isDerived(from)) from._flags |= DIRTY;
    }

    return nextIn;
  };

  // Helper: Check if we should stop at tail marker
  const isAtTail = (node: ToNode, edge: Edge): boolean => !!(node._inTail && edge === node._inTail.nextIn);

  // Helper: Check if source is a computed
  const isDerived = (source: FromNode | ToNode): source is DerivedNode => '_recompute' in source;

  // Helper: Check if computed needs recomputation
  const needsRecompute = (node: ToNode): boolean => ((node._flags & DIRTY) || (!node._inTail && node._in)) !== 0;

  // Helper: Push current state to stack and move to new node
  const pushStack = (
    stack: StackFrame | undefined,
    edge: Edge | undefined,
    node: ToNode,
    stale: boolean
  ): StackFrame => {
    return {
      edge,
      node,
      stale,
      prev: stack,
    };
  };

  // For computed nodes: iteratively check if any dependencies changed
  // Uses manual stack to avoid function call overhead (like Alien Signals)
  // This combines checking and updating in one pass for efficiency
  const isStale = (node: ToNode): boolean => {
    const flags = node._flags;
    
    // Check if already clean
    if ((flags & (INVALIDATED | DIRTY)) === 0) return false;

    // Prevent cycles
    if (flags & RUNNING) return false;

    // If no tail marker, the computed hasn't run yet or all edges are stale
    // In this case, we need to recompute
    if ((!node._inTail && node._in) || flags & DIRTY) return true;

    // For now, we don't use the pattern - just detect it
    // This measures minimal detection overhead

    let stack: StackFrame | undefined;
    let currentNode = node;
    let currentEdge = node._in;
    let stale = false;
    
    // Mark as running to prevent cycles
    node._flags |= RUNNING;

    for (;;) {
      while (currentEdge) {
        // Stop at tail marker - don't check stale edges beyond tail
        if (isAtTail(currentNode, currentEdge)) break;

        const source = currentEdge.from;
        const sFlags = source._flags;

        // Check if source is a dirty signal
        if (sFlags & VALUE_CHANGED) {
          stale = true;
          break;
        }
        
        if (!isDerived(source)) {
          currentEdge = currentEdge.nextIn;
          continue;
        }
        
        // Check if source needs recomputation
        if (needsRecompute(source)) {
          stale = true;
          break;
        }

        if (sFlags & RUNNING) {
          currentEdge = currentEdge.nextIn;
          continue;
        }

        // OPTIMIZATION: For CONSUMED computeds (part of chains), prioritize depth-first
        // CONSUMED flag was set during addEdge when we detected computed->computed pattern
        const sourceFirst = source._in;
        const isConsumedChain = (source._flags & CONSUMED) && sourceFirst;
        
        source._flags |= RUNNING;
        
        // Push current state and traverse into computed
        stack = pushStack(stack, currentEdge.nextIn, currentNode, stale);
        currentNode = source;
        // For consumed chains, start with first dep only (depth-first)
        // For non-consumed, check all deps (breadth-first)
        currentEdge = isConsumedChain ? sourceFirst : source._in;
        stale = false;
      }

      // Update computeds during traversal
      // This avoids the need for a separate recomputation pass
      if (currentNode !== node) {
        if (stale && isDerived(currentNode)) stale = currentNode._recompute();
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

    return stale;
  };

  // ALGORITHM: Complete Edge Removal  
  // Used during disposal to remove all dependency edges at once
  const detachAll = (consumer: ConsumerNode): void => {
    let edge = consumer._in;
    
    // Complete removal - remove all edges
    while (edge) edge = removeEdge(edge);
    
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
    // RemoveEdge handles bidirectional removal and returns next edge
    // Check for stale edges
    // Removing stale edge
    while (toRemove) toRemove = removeEdge(toRemove);

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
      if (targetFlags & ALREADY_HANDLED) {
        currentEdge = currentEdge.nextOut;
        continue;
      }

      // Mark as invalidated (push phase - might be stale)
      // Use cached flags to avoid double read in hot path
      target._flags = targetFlags | INVALIDATED;

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

  return { addEdge, removeEdge, detachAll, pruneStale, isStale, invalidate };
}
