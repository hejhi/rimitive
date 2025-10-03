import type { Dependency, DerivedNode } from '../types';
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

    if (consumer.status === CONSUMER_PENDING) consumer.status = DERIVED_DIRTY;
    sub = sub.nextConsumer!;
  } while (sub);
};

const STATUS_CHECK = DERIVED_DIRTY | SIGNAL_UPDATED | CONSUMER_PENDING;

export function createPullPropagator({
  track
}: {
  track: GraphEdges['track']
}): PullPropagator {
  const pullUpdates = (rootDerived: DerivedNode): boolean => {
    if (!rootDerived.dependencies) return false;

    let stack: StackNode | undefined;
    let consumer = rootDerived;
    let dep: Dependency = consumer.dependencies!;
    let dirty = false;

    // DESCENT PHASE: Walk down the dependency tree checking each dependency
    descent: for (;;) {
      const producer = dep.producer;
			const status = producer.status;

      // Check if this dependency makes the consumer dirty
      if (consumer.status === DERIVED_DIRTY) {
        dirty = true;
      } else if (STATUS_CHECK) switch (status) {
        case DERIVED_DIRTY: {
          // Producer is a dirty derived - recompute it
          const derivedProducer = producer as DerivedNode;
          const val = track(derivedProducer, derivedProducer.compute);

          // Value is unchanged - break out
          if (val === derivedProducer.value) break;

          derivedProducer.value = val;
          const subs = producer.subscribers;
          dirty = true;

          if (subs && subs.nextConsumer !== undefined) shallowPropagate(subs);
          break;
        }
        case SIGNAL_UPDATED: {
          // Signal updated - clear flag and mark dirty
          producer.status = STATUS_CLEAN;
          const subs = producer.subscribers;
          dirty = true;

          if (subs && subs.nextConsumer !== undefined) shallowPropagate(subs);
          break;
        }
        case CONSUMER_PENDING: {
          const derivedProducer = producer as DerivedNode;

          // Check if producer was recomputed AFTER our edge to it was created
          // This handles the "intermediate read" problem where a node is recomputed
          // between two reads by its consumer
          if (derivedProducer.trackingVersion > dep.version) {
            // Producer is stale relative to our view - mark as dirty
            dirty = true;
            break;
          }

          // Producer is pending - need to check its dependencies first
          // Save position if there are siblings (optimization: no allocation in linear chains)
          if (
            dep.nextConsumer !== undefined ||
            dep.prevConsumer !== undefined
          ) {
            stack = { dep, prev: stack };
          }

          // Descend into producer's dependencies
          dep = derivedProducer.dependencies!;
          consumer = derivedProducer;
          continue descent;
        }
      }

      // Try to move to next sibling dependency
      if (!dirty) {
        const nextDep = dep.nextDependency;
        if (nextDep !== undefined) {
          dep = nextDep;
          continue descent;
        }
      }

      // UNWINDING PHASE: Walk back up the tree, recomputing as needed until we return
      unwind: for (;;) {
        if (consumer === rootDerived) return dirty;

        const currConsumer = consumer.subscribers!;
        const hasMultipleSubs = currConsumer.nextConsumer !== undefined;

        // Restore our position (stack vs firstSub based on allocation decision during descent)
        if (hasMultipleSubs) {
          dep = stack!.dep;
          stack = stack!.prev;
        } else dep = currConsumer;

        // Recompute the consumer we just finished checking
        update: if (dirty) {
          const prevValue = consumer.value;
          consumer.value = track(consumer, consumer.compute);

          if (prevValue === consumer.value) {
            // Value unchanged - but keep dirty flag for sibling checks
            break update;
          }
          if (hasMultipleSubs) shallowPropagate(currConsumer);

          consumer = dep.consumer as DerivedNode;
          continue unwind;
        } else consumer.status = STATUS_CLEAN;

        // Move back to parent consumer
        consumer = dep.consumer as DerivedNode;

        // Check if parent has more sibling dependencies
        if (dep.nextDependency !== undefined) {
          dep = dep.nextDependency;
          // Reset dirty when moving to sibling - each sibling is checked independently
          dirty = false;
          continue descent;
        }

        // No more siblings - dirty stays as-is for parent level
        dirty = false;
      }
    }
  };

  return { pullUpdates, shallowPropagate };
}