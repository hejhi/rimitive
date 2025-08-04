import { CONSTANTS } from '../constants';
import type { Edge, ConsumerNode, ScheduledNode, StatefulNode, ProducerNode } from '../types';
import type { SignalContext } from '../context';
import type { ScheduledConsumerHelpers } from './scheduled-consumer';

const { NOTIFIED, DISPOSED, RUNNING } = CONSTANTS;

// OPTIMIZATION: Pre-computed Bitmask
// Combine flags that indicate a node should be skipped during traversal
// Using bitwise OR at compile time for faster runtime checks
const SKIP_FLAGS = NOTIFIED | DISPOSED | RUNNING;

// ALGORITHM: Explicit Stack for Iterative DFS
// Instead of using recursion (which can overflow on deep graphs),
// we maintain an explicit stack of traversal frames.
// Each frame represents a position in the graph we need to return to.
interface TraversalFrame {
  edge: Edge; // The edge to process when we return to this frame
  next: TraversalFrame | undefined; // Link to next frame (linked list stack)
}

export interface GraphTraversalHelpers {
  traverseAndInvalidate: (startEdge: Edge | undefined) => void;
}

/**
 * Creates graph traversal helpers for efficient dependency graph updates.
 * 
 * ALGORITHM: Iterative Depth-First Search with Explicit Stack
 * Traditional recursive DFS can cause stack overflow on deep dependency chains.
 * This implementation uses an explicit stack to traverse arbitrarily deep graphs.
 * 
 * INSPIRATION: This approach is similar to alien-signals and other high-performance
 * reactive libraries that prioritize handling deep dependency chains efficiently.
 */
export function createGraphTraversalHelpers(
  ctx: SignalContext,
  { scheduleConsumer }: ScheduledConsumerHelpers
): GraphTraversalHelpers {
  // OPTIMIZATION: Track last traversal version to skip redundant work
  let lastTraversalVersion = -1;
  let nodesNotifiedThisVersion = 0;
  /**
   * ALGORITHM: Push-Phase Invalidation via Iterative DFS
   * 
   * When a signal changes, we need to invalidate all transitively dependent
   * computeds and effects. This function implements the "push" phase of the
   * push-pull algorithm.
   * 
   * Key insights:
   * 1. We only mark nodes as NOTIFIED (not OUTDATED) for lazy evaluation
   * 2. Effects are scheduled but not executed (deferred until batch end)
   * 3. Already notified nodes are skipped (prevents redundant traversal)
   * 4. Depth-first order ensures proper invalidation ordering
   */
  const traverseAndInvalidate = (startEdge: Edge | undefined): void => {
    if (!startEdge) return;
    
    // OPTIMIZATION: Global Version Fast Path
    // Skip this optimization for now - it can cause correctness issues
    // if not all paths were traversed in the first pass
    
    // Update tracking for this version
    if (lastTraversalVersion !== ctx.version) {
      lastTraversalVersion = ctx.version;
      nodesNotifiedThisVersion = 0;
    }

    // ALGORITHM: Iterative DFS State
    // - stack: Linked list of positions to return to (simulates call stack)
    // - currentEdge: Current position in graph traversal
    let stack: TraversalFrame | undefined;
    let currentEdge: Edge | undefined = startEdge;

    // Main traversal loop - continues until all reachable nodes are processed
    while (currentEdge) {
      const target = currentEdge.target;
      
      // Type guard to check if target is a StatefulNode (has flags)
      if ('_flags' in target) {
        const statefulTarget = target as ConsumerNode & StatefulNode;
        
        // OPTIMIZATION: Early Skip Check
        // Skip nodes that are:
        // - NOTIFIED: Already marked in this invalidation pass
        // - DISPOSED: No longer active, will be cleaned up
        // - RUNNING: Currently executing, will see changes when done
        // This prevents redundant work and infinite loops
        if (statefulTarget._flags & SKIP_FLAGS) {
          currentEdge = currentEdge.nextTarget;
          continue;
        }
        
        // ALGORITHM: Lazy Invalidation Strategy
        // We only mark nodes as NOTIFIED, not OUTDATED. This is key to performance:
        // - NOTIFIED means "might be dirty, check when accessed"
        // - Avoids unnecessary computation if the value is never read
        // - Computed values will verify if truly dirty when accessed
        statefulTarget._flags |= NOTIFIED;
        nodesNotifiedThisVersion++; // Track for optimization
        
        // ALGORITHM: Effect Scheduling
        // Effects are special - they always run when notified, but we defer
        // execution until the batch completes to avoid inconsistent state
        if ('_flush' in target && '_nextScheduled' in target && 'dispose' in target) {
          const scheduledTarget = target as unknown as ScheduledNode;
          scheduleConsumer(scheduledTarget);
        }
      }
      
      // ALGORITHM: Recursive Descent
      // If this consumer is also a producer (i.e., a computed), we need to
      // traverse its dependents too. This handles transitive dependencies.
      if ('_targets' in target) {
        const targetAsProducer = target as ConsumerNode & ProducerNode;
        if (targetAsProducer._targets) {
          // ALGORITHM: Stack Management for Backtracking
          // Before descending, save our position if there are siblings
          // This simulates the return address in recursive DFS
          if (currentEdge.nextTarget) {
            stack = {
              edge: currentEdge.nextTarget,
              next: stack
            };
          }
          
          // Descend into the target's dependencies (depth-first)
          currentEdge = targetAsProducer._targets;
          continue;
        }
      }
      
      // ALGORITHM: Traverse Siblings
      // No children to visit, move to next sibling at current level
      currentEdge = currentEdge.nextTarget;
      
      // ALGORITHM: Backtracking via Stack Pop
      // If no siblings remain, pop saved positions from stack
      // This simulates returning from recursive calls in DFS
      while (!currentEdge && stack) {
        currentEdge = stack.edge;
        stack = stack.next; // Pop the stack frame
        // FLAG: This could be optimized with object pooling for stack frames
      }
    }
  }

  return { traverseAndInvalidate };
}