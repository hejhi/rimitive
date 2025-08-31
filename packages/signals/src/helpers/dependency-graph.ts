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
import { CONSTANTS, createFlagManager } from '../constants';
import type { ProducerNode, ConsumerNode, Edge, ToNode, FromNode, ScheduledNode, DerivedNode } from '../types';

const {
  STATUS_CLEAN,
  STATUS_INVALIDATED,
  STATUS_DIRTY,
  STATUS_CHECKING,
  STATUS_RECOMPUTING,
  HAS_CHANGED,
  MASK_STATUS_AWAITING,
  MASK_STATUS_PROCESSING,
  MASK_STATUS_SKIP_NODE,
} = CONSTANTS;

// Since states are mutually exclusive, we need to check if state is one of these
// Note: CLEAN is 0, so we need special handling

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

const {
  getStatus,
  hasAnyOf,
  resetStatus,
  setStatus
} = createFlagManager();

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
      if (!nextOut && isDerived(from)) from._flags = setStatus(from._flags, STATUS_DIRTY);
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
      if (hasAnyOf(targetFlags, MASK_STATUS_SKIP_NODE | STATUS_INVALIDATED)) {
        currentEdge = currentEdge.nextOut;
        continue;
      }

      // Transition to invalidated state (preserve properties)
      target._flags = setStatus(targetFlags, STATUS_INVALIDATED);

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

  // ALGORITHM: Lazy Staleness Check (like alien-signals checkDirty)
  // This traverses the dependency graph to determine if the node is stale,
  // but ONLY updates nodes when necessary to determine staleness.
  // The target node is always updated if stale.
  // ASSUMES: Caller has already checked that node has DIRTY or INVALIDATED flags
  const checkStale = (node: ToNode): void => {
    const flags = node._flags;
    const status = getStatus(flags);
    
    // Early exit if already clean or in progress
    // Since CLEAN is 0, check it separately, then check if in progress
    if (
      status === STATUS_CLEAN ||
      status === STATUS_CHECKING ||
      status === STATUS_RECOMPUTING
    )
      return;
    
    // For DIRTY nodes, update directly without intermediate state
    if (status === STATUS_DIRTY) {
      if ('_recompute' in node) {
        node._flags = setStatus(flags, STATUS_RECOMPUTING);
        node._recompute();
      }
      node._flags = resetStatus(node._flags);
      return;
    }
    
    // For INVALIDATED nodes, transition to checking state
    node._flags = setStatus(flags, STATUS_CHECKING);

    // At this point, we know the node is INVALIDATED (not DIRTY)
    // Check staleness with minimal updates (like alien-signals)
    let stack: Stack<Edge> | undefined;
    let currentNode = node;
    let currentEdge = node._in;
    let stale = false;

    for (;;) {
      while (currentEdge) {
        const source = currentEdge.from;
        const sFlags = source._flags;

        // Check if source is a dirty signal (has HAS_CHANGED property)
        if (hasAnyOf(sFlags, HAS_CHANGED)) {
          stale = true;
          break;
        }

        const nextEdge = currentEdge.nextIn;

        // Inline isDerived check - check if source has _recompute method
        if (!('_recompute' in source)) {
          currentEdge = nextEdge;
          continue;
        }

        // If source needs update (DIRTY or INVALIDATED), handle it
        if (hasAnyOf(sFlags, MASK_STATUS_AWAITING)) {
          // Prevent cycles - skip if already checking or recomputing
          if (hasAnyOf(sFlags, MASK_STATUS_PROCESSING)) {
            currentEdge = nextEdge;
            continue;
          }

          const sourceStatus = getStatus(sFlags);
          
          // DIRTY nodes must be updated immediately to determine staleness
          if (sourceStatus === STATUS_DIRTY) {
            source._flags = setStatus(sFlags, STATUS_RECOMPUTING);
            source._recompute();
            const newFlags = source._flags;
            source._flags = resetStatus(newFlags);
            
            // Check if the update made it stale
            if (hasAnyOf(newFlags, HAS_CHANGED)) {
              stale = true;
              break;
            }
            currentEdge = nextEdge;
            continue;
          }

          // INVALIDATED nodes - traverse into them to check
          // Transition source to checking state (preserve properties)
          source._flags = setStatus(sFlags, STATUS_CHECKING);

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
      // Only update intermediate nodes if they were DIRTY or found to be stale
      if (currentNode !== node && ('_recompute' in currentNode)) {
        const currentFlags = currentNode._flags;
        const currentState = getStatus(currentFlags);
        
        // Only recompute if DIRTY or stale dependencies found
        if (currentState === STATUS_DIRTY || stale) {
          currentNode._flags = setStatus(currentFlags, STATUS_RECOMPUTING);
          currentNode._recompute();
          const newFlags = currentNode._flags;
          stale = hasAnyOf(newFlags, HAS_CHANGED);
          currentNode._flags = resetStatus(newFlags);
        } else {
          // Not stale - just clear the CHECKING state
          currentNode._flags = resetStatus(currentFlags);
          // Important: don't propagate staleness if this node didn't change
          stale = false;
        }
      }
      
      // Pop from stack or break
      if (!stack) break;
      
      currentEdge = stack.value;
      currentNode = currentEdge.to;
      stack = stack.prev;
    }

    // If stale, recompute the root node
    if (stale && ('_recompute' in node)) {
      node._flags = setStatus(node._flags, STATUS_RECOMPUTING);
      node._recompute();
    }
    
    // Transition root node to clean state (single operation)
    node._flags = resetStatus(node._flags);
  };

  return { addEdge, removeEdge, detachAll, pruneStale, checkStale, invalidate };
}
