import type { Dependency, DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { DERIVED_DIRTY, CONSUMER_PENDING, SIGNAL_UPDATED, STATUS_CLEAN } = CONSTANTS;

// Minimal stack node for pull traversal
interface StackNode {
  dep: Dependency;
  prev: StackNode | undefined;
}

export interface PullPropagator {
  pullUpdates: (node: DerivedNode) => boolean;
  shallowPropagate: (sub: Dependency) => void;
}

// Upgrade PENDING siblings to DIRTY
const shallowPropagate = (sub: Dependency) => {
  do {
    const consumer = sub.consumer;
    // Check if PENDING flag is set AND DIRTY flag is NOT set (matching Alien's logic)
    if ((consumer.status & (CONSUMER_PENDING | DERIVED_DIRTY)) === CONSUMER_PENDING) {
      consumer.status = consumer.status | DERIVED_DIRTY;
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
  const pullUpdates = (consumer: DerivedNode): boolean => {
    if (!consumer.dependencies) return false;

    let checkDepth = 0;
    let stack: StackNode | undefined;
    let dep: Dependency = consumer.dependencies;

    traversal: for (; ;) {
      const producer = dep.producer;
      const pStatus = producer.status;
      let dirty = false;

      if (consumer.status & DERIVED_DIRTY) {
        // Consumer is already dirty
        dirty = true;
      } else if (pStatus & DERIVED_DIRTY) {
        // Derived Producer is dirty and needs recomputation
        producer.status = STATUS_CLEAN;
        const derivedProducer = producer as DerivedNode;
        const val = track(ctx, derivedProducer, derivedProducer.compute);
        
        if (val !== derivedProducer.value) {
          derivedProducer.value = val;
          const pSubs = producer.subscribers;
          if (pSubs !== undefined && pSubs.nextConsumer !== undefined) {
            shallowPropagate(pSubs);
          }
          dirty = true;
        }
      } else if (pStatus & SIGNAL_UPDATED) {
        // Signal has been updated, clear flag and propagate to siblings
        producer.status = STATUS_CLEAN;
        const subs = producer.subscribers;
        if (subs && subs.nextConsumer !== undefined) {
          shallowPropagate(subs);
        }
        dirty = true;
      } else if (pStatus & CONSUMER_PENDING) {
        // Pending computed - recurse into it
        // Only allocate stack if there are sibling subscribers (saves allocations in linear chains)
        if (dep.nextConsumer !== undefined || dep.prevConsumer !== undefined) {
          stack = { dep, prev: stack };
        }
        dep = (producer as DerivedNode).dependencies!;
        consumer = producer as DerivedNode;
        ++checkDepth;
        continue;
      }

      // If not dirty, check next dependency
      if (!dirty) {
        const nextDep = dep.nextDependency;
        if (nextDep !== undefined) {
          dep = nextDep;
          continue;
        }
      }

      // Unwind: go back up the dependency tree
      while (checkDepth--) {
        const firstSub = (consumer as DerivedNode).subscribers!;
        const hasMultipleSubs = firstSub.nextConsumer !== undefined;

        if (hasMultipleSubs) {
          dep = stack!.dep;
          stack = stack!.prev;
        } else {
          dep = firstSub;
        }

        if (dirty) {
          const derivedSub = consumer as DerivedNode;
          const prev = derivedSub.value;
          derivedSub.value = track(ctx, derivedSub, derivedSub.compute);

          if (prev !== derivedSub.value) {
            if (hasMultipleSubs) {
              shallowPropagate(firstSub);
            }
            consumer = dep.consumer as DerivedNode;
            continue;
          }
        } else {
          consumer.status = STATUS_CLEAN;
        }

        consumer = dep.consumer as DerivedNode;
        if (dep.nextDependency !== undefined) {
          dep = dep.nextDependency;
          continue traversal;
        }
        dirty = false;
      }

      return dirty;
    }
  };

  return { pullUpdates, shallowPropagate };
}