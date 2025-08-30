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
import type { SignalContext } from '../context';

const { INVALIDATED, DIRTY, DISPOSED, RUNNING, VALUE_CHANGED } = CONSTANTS;
const SKIP_FLAGS = DISPOSED | RUNNING;
const ALREADY_HANDLED = SKIP_FLAGS | INVALIDATED;

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

export function createDependencyGraph(_ctx: SignalContext): DependencyGraph {
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
      // When a computed becomes completely unobserved, mark as DIRTY
      if (!nextOut && isDerived(from)) from._flags |= DIRTY;
    }

    return nextIn;
  };

  // Helper: Check if we should stop at tail marker
  const isAtTail = (node: ToNode, edge: Edge): boolean => !!(node._inTail && edge === node._inTail.nextIn);

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

  // ALGORITHM: Single-Pass Staleness Check and Update
  // Similar to Alien's checkDirty, this traverses the dependency graph once
  // and updates ALL computeds in the chain, including the root node.
  // This prevents redundant isStale() calls during recomputation.
  const checkStale = (node: ToNode): void => {
    const flags = node._flags;
    
    // Already clean - nothing to do
    if ((flags & (INVALIDATED | DIRTY)) === 0) return;
    
    // Prevent cycles
    if (flags & RUNNING) return;
    
    // For DIRTY nodes, just recompute directly
    if (flags & DIRTY) {
      if (isDerived(node)) {
        node._flags |= RUNNING;
        node._recompute();
        node._flags &= ~(RUNNING | DIRTY);
      }
      return;
    }
    
    // For INVALIDATED nodes, do a modified isStale that updates the chain
    if (flags & INVALIDATED) {
      // Modified isStale logic that updates dependencies during traversal
      let stack: Stack<Edge> | undefined;
      let currentNode = node;
      let currentEdge = node._in;
      let stale = false;
      
      // Mark as running to prevent cycles
      node._flags |= RUNNING;

      for (;;) {
        while (currentEdge) {
          // Stop at tail marker
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
          
          // If source is DIRTY or INVALIDATED, update it first
          if (sFlags & (DIRTY | INVALIDATED)) {
            // Recursively update the source
            if (!(sFlags & RUNNING)) {
              source._flags |= RUNNING;
              
              // Store current position
              const nextEdge = currentEdge.nextIn;
              if (nextEdge) {
                stack = { value: nextEdge, prev: stack };
              }
              
              // Check if source is stale and update if needed
              let sourceStale = false;
              if (sFlags & DIRTY) {
                sourceStale = true;
              } else if (sFlags & INVALIDATED) {
                // Quick check - if source has no deps or all are clean, not stale
                let sourceEdge = source._in;
                while (sourceEdge && !isAtTail(source, sourceEdge)) {
                  const dep = sourceEdge.from;
                  if (dep._flags & VALUE_CHANGED) {
                    sourceStale = true;
                    break;
                  }
                  sourceEdge = sourceEdge.nextIn;
                }
              }
              
              if (sourceStale) {
                source._recompute();
                // After recompute, check if value changed
                if (source._flags & VALUE_CHANGED) {
                  stale = true;
                  // Clear flags
                  source._flags &= ~(RUNNING | DIRTY | INVALIDATED);
                  break;
                }
              }
              
              // Clear flags
              source._flags &= ~(RUNNING | DIRTY | INVALIDATED);
            }
            
            currentEdge = currentEdge.nextIn;
            continue;
          }

          // Source is clean, check if it has a changed value
          if (sFlags & VALUE_CHANGED) {
            stale = true;
            break;
          }
          
          currentEdge = currentEdge.nextIn;
        }

        // Pop from stack or break
        if (!stack) break;
        
        if (stale) break;
        
        currentEdge = stack.value;
        currentNode = currentEdge.to;
        stack = stack.prev;
      }

      // Clear RUNNING flag from root node
      node._flags &= ~(RUNNING | INVALIDATED);

      // If stale, recompute the root node
      if (stale && isDerived(node)) {
        node._recompute();
      }
    }
  };

  return { addEdge, removeEdge, detachAll, pruneStale, checkStale, invalidate };
}
