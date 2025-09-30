import type { Dependency, DerivedNode, FromNode, ToNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { STATUS_DIRTY, STATUS_CLEAN, STATUS_PENDING, NEEDS_PULL, FORCE_RECOMPUTE } = CONSTANTS;

// Minimal stack node for pull traversal
interface StackNode {
  dep: Dependency;
  prev: StackNode | undefined;
  needsRecompute: boolean;  // Parent's recompute state
}

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => void;
}

// Upgrade PENDING siblings to DIRTY
const shallowPropagate = (node: FromNode) => {
  let sub = node.subscribers;
  while (sub) {
    if (sub.consumer.status === STATUS_PENDING) {
      sub.consumer.status = STATUS_DIRTY;
    }
    sub = sub.nextConsumer;
  }
};

export function createPullPropagator({
  ctx,
  track
}: {
  ctx: GlobalContext,
  track: GraphEdges['track']
}): PullPropagator {
  const pullUpdates = (rootNode: DerivedNode): void => {
    let current: ToNode = rootNode;
    let stack: StackNode | undefined;
    let dep: Dependency | undefined;
    let needsRecompute = false;

    traversal: while (true) {
      // Early exit if already clean
      if (current.status === STATUS_CLEAN) {
        if (!stack) return;

        // Pop from stack
        dep = stack.dep.nextDependency;
        current = stack.dep.consumer;
        needsRecompute = stack.needsRecompute;
        stack = stack.prev;
        continue;
      }

      // Check if node itself forces recomputation
      if (current.status & FORCE_RECOMPUTE) needsRecompute = true;

      // Start dependency iteration if needed
      if (dep === undefined) dep = current.dependencies;

      // Pull stale dependencies
      if (dep) {
        do {
          const producer = dep.producer;

          if (producer.status & NEEDS_PULL) {
            // Recurse into stale computed
            if ('compute' in producer) {
              stack = { dep, prev: stack, needsRecompute };
              current = producer;
              needsRecompute = false;
              dep = undefined;
              continue traversal;
            }

            // Handle dirty signal
            if (producer.status === STATUS_DIRTY) {
              needsRecompute = true;
              shallowPropagate(producer);
              producer.status = STATUS_CLEAN;
            }
          }

          dep = dep.nextDependency;
        } while (dep);
      }

      // Recompute if needed
      if ('value' in current && needsRecompute) {
        const prev = current.value;
        current.value = track(ctx, current, current.compute);

        if (prev !== current.value) {
          shallowPropagate(current);
          // Notify parent that this child changed
          if (stack) stack.needsRecompute = true;
        }
      }

      current.status = STATUS_CLEAN;

      // Pop to parent or exit
      if (!stack) return;

      dep = stack.dep.nextDependency;
      current = stack.dep.consumer;
      needsRecompute = stack.needsRecompute;
      stack = stack.prev;
    }
  };

  return { pullUpdates };
}