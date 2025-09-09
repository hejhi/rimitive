/**
 * ALGORITHM: Lazy Computed Values with Push-Pull Reactivity
 * 
 * Computed values are the heart of the reactive system.
 */

import { CONSTANTS } from './constants';
import { DerivedNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { GlobalContext } from './context';
import { GraphEdges } from './helpers/graph-edges';
import { PullPropagator } from './helpers/pull-propagator';

// Single function interface for both read and peek
// The function also implements ProducerNode and ConsumerNode to expose graph properties
export interface ComputedFunction<T = unknown> extends DerivedNode {
  (): T;                    // Read operation (tracks dependencies)
  peek(): T;                // Non-tracking read
}

export type ComputedContext = GlobalContext & {
  graphEdges: GraphEdges;
  pullPropagator: PullPropagator;
}

// Internal computed state that gets bound to the function
interface ComputedState<T> extends DerivedNode {
  __type: 'computed';
  value: T; // Cached computed value
}

const { STATUS_PENDING, DIRTY } = CONSTANTS;

// BACKWARDS COMPATIBILITY: Export interface alias
export type ComputedInterface<T = unknown> = ComputedFunction<T>;

export function createComputedFactory(
  ctx: ComputedContext
): LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>> {
  const {
    graphEdges: { trackDependency },
    pullPropagator: { pullUpdates },
  } = ctx;

  function createComputed<T>(compute: () => T): ComputedFunction<T> {
    const node: ComputedState<T> = {
      __type: 'computed' as const,
      value: undefined as T,
      dependents: undefined,
      dependentsTail: undefined,
      dependencies: undefined, // Will be set to old dependencies when they exist
      dependencyTail: undefined, // Don't clear during recompute - preserve for traversal
      flags: STATUS_PENDING, // Start in PENDING state so first access triggers computation
      lastComputedVersion: -1, // Never computed yet
      lastChangedVersion: -1, // Never changed yet
      compute: compute as () => unknown, // Store the compute function directly
      notify: () => undefined,
    };

    // Single-pass update using pullUpdates
    const update = () => pullUpdates(node);

    const computed = (() => {
      // Treat computed exactly like a signal for dependency tracking
      // Register with current consumer FIRST (like signals do)
      const consumer = ctx.currentConsumer;

      // Always link if there's a consumer
      // Create edge to consumer
      if (consumer) trackDependency(node, consumer, ctx.trackingVersion);
      update();
      
      // Clear DIRTY flag after reading (like signals do)
      // This prevents downstream computeds from thinking we changed when we didn't
      node.flags &= ~DIRTY;

      return node.value;
    }) as ComputedFunction<T>;

    computed.peek = () => {
      // Non-tracking Read
      // Always prevent dependency tracking for peek
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = null; // Prevent ALL dependency tracking

      try {
        update();
      } finally {
        ctx.currentConsumer = prevConsumer; // Restore back to previous state
      }

      return node.value;
    };

    return computed;
  }

  return {
    name: 'computed',
    method: createComputed,
  };
}
