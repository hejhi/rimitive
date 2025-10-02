import type { Dependency, DerivedNode } from '../types';
import type { GlobalContext } from '../context';
import { CONSTANTS } from '../constants';
import { GraphEdges } from './graph-edges';

// Re-export types for proper type inference
export type { DerivedNode } from '../types';
export type { GlobalContext } from '../context';
export type { GraphEdges } from './graph-edges';

const { DERIVED_DIRTY, CONSUMER_PENDING, DERIVED_PULL, SIGNAL_UPDATED, DERIVED_PRISTINE } = CONSTANTS;

// Minimal stack node for pull traversal
interface StackNode {
  dep: Dependency;
  prev: StackNode | undefined;
  needsRecompute: boolean;  // Parent's recompute state
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
  const pullUpdates = (sub: DerivedNode): boolean => {
    if (!sub.dependencies) return false;

    let needsRecompute = false;
    let checkDepth = 0;
    let stack: StackNode | undefined;
    let link: Dependency = sub.dependencies;

    traversal: for (; ;) {
      const dep = link.producer;
      const flags = dep.status;
      let dirty = false;

      // Check if consumer is already dirty or pristine
      if (sub.status & (DERIVED_DIRTY | DERIVED_PRISTINE)) {
        dirty = true;
      } else if (flags & SIGNAL_UPDATED) {
        // Signal has been updated, clear flag and propagate to siblings
        const subs = dep.subscribers;
        if (subs && subs.nextConsumer !== undefined) {
          shallowPropagate(subs);
        }
        dirty = true;
      } else if (flags & DERIVED_PULL) {
        // Pending computed - recurse into it
        // Only allocate stack if there are sibling subscribers (saves allocations in linear chains)
        if (link.nextConsumer !== undefined || link.prevConsumer !== undefined) {
          stack = { dep: link, prev: stack, needsRecompute };
        }
        link = (dep as DerivedNode).dependencies!;
        sub = dep as DerivedNode;
        ++checkDepth;
        continue;
      }

      // If not dirty, check next dependency
      if (!dirty) {
        const nextDep = link.nextDependency;
        if (nextDep !== undefined) {
          link = nextDep;
          continue;
        }
      }

      // Unwind: go back up the dependency tree
      while (checkDepth--) {
        const firstSub = (sub as DerivedNode).subscribers!;
        const hasMultipleSubs = firstSub.nextConsumer !== undefined;
        if (hasMultipleSubs) {
          link = stack!.dep;
          stack = stack!.prev;
        } else {
          link = firstSub;
        }

        if (dirty) {
          const derivedSub = sub as DerivedNode;
          const prev = derivedSub.value;
          derivedSub.value = track(ctx, derivedSub, derivedSub.compute);

          if (prev !== derivedSub.value) {
            if (hasMultipleSubs) {
              shallowPropagate(firstSub);
            }
            sub = link.consumer as DerivedNode;
            continue;
          }
        } else {
          sub.status &= ~CONSUMER_PENDING;
        }

        sub = link.consumer as DerivedNode;
        if (link.nextDependency !== undefined) {
          link = link.nextDependency;
          continue traversal;
        }
        dirty = false;
      }

      return dirty;
    }
  };

  return { pullUpdates, shallowPropagate };
}