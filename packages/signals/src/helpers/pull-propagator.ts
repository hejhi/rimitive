import type { Dependency, DerivedNode, FromNode, ToNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { DERIVED_DIRTY, STATUS_CLEAN, CONSUMER_PENDING, DERIVED_PULL, FORCE_RECOMPUTE, SIGNAL_UPDATED } = CONSTANTS;

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
const shallowPropagate = (sub: Dependency) => {
  do {
    const consumer = sub.consumer;
    if (consumer.status === CONSUMER_PENDING) {
      consumer.status = DERIVED_DIRTY;
    }
    sub = sub.nextConsumer!;
  } while (sub);
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

    traversal: for (;;) {
      // Early exit if already clean
      if (current.status === STATUS_CLEAN) {
        if (!stack) return;
        
        const stackDep = stack.dep;
        dep = stackDep.nextDependency;
        current = stackDep.consumer;
        needsRecompute = stack.needsRecompute;
        stack = stack.prev;
        continue;
      }

      // Check if node itself forces recomputation
      if (current.status & FORCE_RECOMPUTE) needsRecompute = true;

      // Start dependency iteration if needed
      if (dep === undefined) dep = current.dependencies;

      // Pull stale dependencies
      if (dep !== undefined) {
        do {
          const producer: FromNode = dep.producer;
          const status = producer.status;

          // Recurse into stale computed (only computeds can have DERIVED_PULL status)
          if (status & DERIVED_PULL) {
            stack = { dep, prev: stack, needsRecompute };
            current = producer as DerivedNode;
            needsRecompute = false;
            dep = undefined;
            continue traversal;
          }

          if (status & SIGNAL_UPDATED) {
            needsRecompute = true;
            const sub = producer.subscribers;
            if (
              sub &&
              (stack === undefined || sub.nextConsumer !== undefined)
            ) shallowPropagate(sub);
            producer.status = STATUS_CLEAN;
          }

          dep = dep.nextDependency;
        } while (dep);
      }

      // Recompute if needed
      // Note: current is always a DerivedNode because we only recurse when
      if (needsRecompute) {
        const derivedCurrent = current as DerivedNode;
        const prev = derivedCurrent.value;
        derivedCurrent.value = track(ctx, derivedCurrent, derivedCurrent.compute);

        if (prev !== derivedCurrent.value) {
          const sub = derivedCurrent.subscribers;
          // Only propagate if there are multiple subscribers OR if we're not on the stack
          // If single subscriber and on stack, parent handles it via stack.needsRecompute
          if (sub && (stack === undefined || sub.nextConsumer !== undefined)) {
            shallowPropagate(sub);
          }

          // Notify parent that this child changed
          if (stack !== undefined) stack.needsRecompute = true;
        }
      }

      current.status = STATUS_CLEAN;

      // Pop to parent or exit
      if (!stack) return;

      const stackDep = stack.dep;
      dep = stackDep.nextDependency;
      current = stackDep.consumer;
      needsRecompute = stack.needsRecompute;
      stack = stack.prev;
    }
  };

  return { pullUpdates };
}