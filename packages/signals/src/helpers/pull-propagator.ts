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
  prev: StackFrame | undefined;
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
    let stack: StackFrame | undefined = { node: rootNode, prev: undefined };

    traversal: do {
      const node = stack.node;
      const flags = node.flags;
      const status = flags & MASK_STATUS;

      stack = stack.prev;

      // If node is DIRTY (from a dependency that changed), recompute it
      if (status === STATUS_DIRTY) {
        // If value changed and we have a parent on the stack, mark it for direct recompute
        // Check if parent is already marked for direct recompute
        if (recomputeNode(node) && stack) stack.node.flags = STATUS_DIRTY;
        continue;
      }

      // Skip disposed or already-processed nodes
      // Continue only if PENDING and not DISPOSED
      if (status !== STATUS_PENDING) continue;

      // Check all dependencies: defer PENDING computeds, recompute if any are DIRTY
      let dep = node.dependencies;

      // No dependencies - just recompute
      if (!dep) {
        if (recomputeNode(node) && stack) stack.node.flags = STATUS_DIRTY;
        continue;
      }

      while (dep) {
        const producer = dep.producer;
        const pStatus = producer.flags & MASK_STATUS;

        switch (pStatus) {
          case STATUS_DIRTY:
            // If value changed and we have a parent on the stack, mark it dirty
            if (recomputeNode(node) && stack) stack.node.flags = STATUS_DIRTY;
            continue traversal; // Done with this node
          case STATUS_PENDING:
            if ('compute' in producer) {
              // Push current node first (to process after), then dependency (to process next)
              stack = { node, prev: stack };  // Current node for later
              stack = { node: producer, prev: stack };  // Dependency to process now
              continue traversal; // Process the dependency first
            }
        }
        
        dep = dep.nextDependency;
      }

      // No dependencies were dirty or pending, clear flags
      node.flags = 0;
    } while (stack)
  };

  return { pullUpdates };
}