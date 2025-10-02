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
  const pullUpdates = (rootConsumer: DerivedNode): boolean => {
    if (!rootConsumer.dependencies) return false;

    let stack: StackNode | undefined;
    let consumer = rootConsumer;
    let dep: Dependency = consumer.dependencies!;
    let dirty = false;

    // DESCENT PHASE: Walk down the dependency tree checking each dependency
    descent: for (;;) {
      const producer = dep.producer;
      const flags = producer.status;

      // Check if this dependency makes the consumer dirty
      if (consumer.status & DERIVED_DIRTY) {
        dirty = true;
      } else if (flags & DERIVED_DIRTY) {
        // Producer is a dirty computed - recompute it
        producer.status = STATUS_CLEAN;
        const derivedProducer = producer as DerivedNode;
        const val = track(ctx, derivedProducer, derivedProducer.compute);

        if (val !== derivedProducer.value) {
          derivedProducer.value = val;
          const subs = producer.subscribers;
          if (subs?.nextConsumer !== undefined) {
            shallowPropagate(subs);
          }
          dirty = true;
        }
      } else if (flags & SIGNAL_UPDATED) {
        // Signal updated - clear flag and mark dirty
        producer.status = STATUS_CLEAN;
        const subs = producer.subscribers;
        if (subs?.nextConsumer !== undefined) {
          shallowPropagate(subs);
        }
        dirty = true;
      } else if (flags & CONSUMER_PENDING) {
        // Producer is pending - need to check its dependencies first
        // Save position if there are siblings (optimization: no allocation in linear chains)
        if (dep.nextConsumer !== undefined || dep.prevConsumer !== undefined) {
          stack = { dep, prev: stack };
        }

        // Descend into producer's dependencies
        dep = (producer as DerivedNode).dependencies!;
        consumer = producer as DerivedNode;
        continue descent;
      }

      // Try to move to next sibling dependency
      if (!dirty && dep.nextDependency !== undefined) {
        dep = dep.nextDependency;
        continue descent;
      }

      // UNWINDING PHASE: Walk back up the tree, recomputing as needed
      // Unwind until we're back at the root consumer
      unwind: while (consumer !== rootConsumer) {
        const currentSubs = consumer.subscribers!;
        const hasMultipleSubs = currentSubs.nextConsumer !== undefined;

        // Restore our position (stack vs firstSub based on allocation decision during descent)
        if (hasMultipleSubs) {
          dep = stack!.dep;
          stack = stack!.prev;
        } else {
          dep = currentSubs;
        }

        // Recompute the consumer we just finished checking
        if (dirty) {
          const prevValue = consumer.value;
          consumer.value = track(ctx, consumer, consumer.compute);

          if (prevValue !== consumer.value) {
            // Value changed - propagate to siblings and keep unwinding
            if (hasMultipleSubs) {
              shallowPropagate(currentSubs);
            }
            consumer = dep.consumer as DerivedNode;
            continue unwind;
          }
          // Value unchanged - fall through to check for siblings
        } else {
          // Not dirty - mark clean
          consumer.status = STATUS_CLEAN;
        }

        // Move back to parent consumer
        consumer = dep.consumer as DerivedNode;

        // Reset dirty flag and check if parent has more sibling dependencies
        dirty = false;
        if (dep.nextDependency !== undefined) {
          dep = dep.nextDependency;
          continue descent;
        }
      }

      // Finished unwinding - we're done
      return dirty;
    }
  };

  return { pullUpdates, shallowPropagate };
}