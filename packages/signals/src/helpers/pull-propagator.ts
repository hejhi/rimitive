import type { DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

const { STATUS_PENDING, STATUS_DIRTY, MASK_STATUS } = CONSTANTS;

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

interface StackFrame {
  node: DerivedNode;
  next: StackFrame | undefined;
}

export function createPullPropagator(ctx: GlobalContext & { graphEdges: GraphEdges }): PullPropagator {
  const { startTracking, endTracking } = ctx.graphEdges;

  // Inline recomputation logic here since we have access to context
  const recomputeNode = (node: DerivedNode): boolean => {
    const prevConsumer = startTracking(ctx, node);
    const oldValue = node.value;

    try {
      const newValue = node.compute();

      // Update value and set flags based on whether it changed
      if (newValue !== oldValue) {
        node.value = newValue;
        node.flags = STATUS_DIRTY;
        return true;
      }
      
      // Value didn't change, clear flags
      node.flags = 0;
      return false;
    } finally {
      // End tracking, restore context, and prune stale dependencies
      endTracking(ctx, node, prevConsumer);
    }
  };

  const pullUpdates = (rootNode: DerivedNode): void => {
    let stack: StackFrame | undefined = { node: rootNode, next: undefined };

    traversal: do {
      const node = stack.node;
      const flags = node.flags;

      stack = stack.next;
      const status = flags & MASK_STATUS;

      // If node is DIRTY (from a dependency that changed), recompute it
      if (status === STATUS_DIRTY) {
        recomputeNode(node);
        // If this node's value changed, its parent (next on stack) will be marked DIRTY
        // and will recompute when we unwind to it
        continue;
      }

      // Skip disposed or already-processed nodes
      // Continue only if PENDING and not DISPOSED
      if (status !== STATUS_PENDING) continue;

      // Check all dependencies: defer PENDING computeds, recompute if any are DIRTY
      let dep = node.dependencies;

      // No dependencies - just recompute
      if (!dep) {
        recomputeNode(node);
        continue;
      }

      while (dep) {
        const producer = dep.producer;
        const pFlags = producer.flags;

        // If dependency is dirty, recompute immediately
        if ((pFlags & MASK_STATUS) === STATUS_DIRTY) {
          const changed = recomputeNode(node);
          // If value changed and we have a parent on the stack, mark it dirty
          if (changed && stack) {
            stack.node.flags = STATUS_DIRTY;
          }
          continue traversal; // Done with this node
        }
        
        // If dependency is a pending computed, we need to process it first
        if ('compute' in producer && pFlags & STATUS_PENDING) {
          // Add the dependency to process immediately, then the current node
          stack = { node: producer, next: { node, next: stack } };
          continue traversal; // Process the dependency first
        }
        
        dep = dep.nextDependency;
      }

      // No dependencies were dirty or pending, clear flags
      node.flags = 0;
    } while (stack)
  };

  return { pullUpdates };
}