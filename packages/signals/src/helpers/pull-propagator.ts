import type { Dependency, DerivedNode, FromNode, ToNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { DERIVED_DIRTY, STATUS_CLEAN, CONSUMER_PENDING, DERIVED_PULL, SIGNAL_UPDATED } = CONSTANTS;

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
    let dep: Dependency | undefined = rootNode.dependencies;

    // No dependencies - just recompute if needed
    if (!dep) {
      if (rootNode.status & (DERIVED_DIRTY | DERIVED_PULL)) {
        rootNode.status = STATUS_CLEAN;
        rootNode.value = track(ctx, rootNode, rootNode.compute);
      } else {
        rootNode.status = STATUS_CLEAN;
      }
      return;
    }

    let needsRecompute = false;
    let checkDepth = 0;
    let stack: StackNode | undefined;

    traversal: for (;;) {
      let dirty = false;

      // Check if current node is already dirty
      if (current.status & DERIVED_DIRTY) {
        dirty = true;
      } else if (dep) {
        // Core check: examine dependency status
        const producer: FromNode = dep.producer;
        const status = producer.status;

        if (status & SIGNAL_UPDATED) {
          // Signal has updated - mark clean and notify siblings
          producer.status = STATUS_CLEAN;
          const subs = producer.subscribers;
          if (subs !== undefined && subs.nextConsumer !== undefined) {
            shallowPropagate(subs);
          }
          dirty = true;
        } else if (status & DERIVED_DIRTY) {
          // Computed is dirty - recompute to check if value changed
          const derivedProducer = producer as DerivedNode;
          const prev = derivedProducer.value;
          derivedProducer.status = STATUS_CLEAN;
          derivedProducer.value = track(ctx, derivedProducer, derivedProducer.compute);

          if (prev !== derivedProducer.value) {
            const subs = derivedProducer.subscribers;
            if (subs !== undefined && subs.nextConsumer !== undefined) {
              shallowPropagate(subs);
            }
            dirty = true;
          }
        } else if (status & DERIVED_PULL) {
          // Pending computed - need to recurse into its dependencies
          // Only allocate stack if there are sibling dependencies (saves 1M allocations in linear chains!)
          if (dep.nextDependency !== undefined || dep.prevDependency !== undefined) {
            stack = { dep, prev: stack, needsRecompute };
          }
          const derivedProducer = producer as DerivedNode;
          dep = derivedProducer.dependencies; // Start checking this producer's dependencies
          current = derivedProducer;
          needsRecompute = false;
          ++checkDepth;
          continue traversal;
        }
      }

      // If not dirty, move to next dependency
      if (!dirty && dep) {
        const nextDep = dep.nextDependency;
        if (nextDep !== undefined) {
          dep = nextDep;
          continue;
        }
      }

      // Unwind: we've either finished checking all deps, or found dirty and need to go back up
      while (checkDepth > 0) {
        --checkDepth;
        const firstSub: Dependency | undefined = (current as DerivedNode).subscribers;
        const hasMultipleSubs =
          firstSub !== undefined && firstSub.nextConsumer !== undefined;

        if (hasMultipleSubs) {
          // Branch point - pop stack to get sibling dependency
          dep = stack!.dep;
          stack = stack!.prev;
        } else {
          // Linear chain - follow single subscriber back up
          dep = firstSub;
        }

        // If dirty, recompute current node
        if (dirty) {
          const derivedCurrent = current as DerivedNode;
          const prev = derivedCurrent.value;
          derivedCurrent.status = STATUS_CLEAN;
          derivedCurrent.value = track(ctx, derivedCurrent, derivedCurrent.compute);

          if (prev !== derivedCurrent.value) {
            // Value changed - propagate to siblings if needed
            if (hasMultipleSubs) {
              shallowPropagate(firstSub);
            }
            current = dep!.consumer;
            continue; // Continue unwinding
          }
        } else {
          // Not dirty - just mark as clean (clear PENDING flag)
          current.status = STATUS_CLEAN;
        }

        // Move to parent consumer
        current = dep!.consumer;

        // Check if there's a next dependency at this level
        if (dep!.nextDependency !== undefined) {
          dep = dep!.nextDependency;
          continue traversal;
        }

        // No more siblings - mark not dirty and continue unwinding
        dirty = false;
      }

      // After unwinding, check if there are more dependencies at the root level
      if (dep && dep.nextDependency !== undefined) {
        dep = dep.nextDependency;
        needsRecompute = needsRecompute || dirty;
        continue traversal;
      }

      // Fully unwound - now update the root node itself if needed
      if (needsRecompute || dirty) {
        rootNode.status = STATUS_CLEAN;
        rootNode.value = track(ctx, rootNode, rootNode.compute);
      } else {
        rootNode.status = STATUS_CLEAN;
      }

      return;
    }
  };

  return { pullUpdates };
}