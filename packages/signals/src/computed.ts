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
export interface ComputedFunction<T = unknown> {
  (): T;
  peek(): T;
}

export type ComputedContext = GlobalContext & {
  graphEdges: GraphEdges;
  pullPropagator: PullPropagator;
}

// Internal computed state that gets bound to the function
interface ComputedNode<T> extends DerivedNode {
  __type: 'computed';
  value: T;
}

const { STATUS_PENDING } = CONSTANTS;

// Shared NOOP function to avoid allocating one per computed
const NOOP = () => undefined;

export function createComputedFactory(
  ctx: ComputedContext
): LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>> {
  const {
    graphEdges: { trackDependency },
    pullPropagator: { pullUpdates },
  } = ctx;

  function createComputed<T>(compute: () => T): ComputedFunction<T> {
    const node: ComputedNode<T> = {
      __type: 'computed' as const,
      value: undefined as T,
      subscribers: undefined,
      subscribersTail: undefined,
      dependencies: undefined, // Will be set to old dependencies when they exist
      dependencyTail: undefined, // Don't clear during recompute - preserve for traversal
      deferredDep: undefined,
      deferredParent: undefined,
      flags: STATUS_PENDING, // Start in PENDING state so first access triggers computation
      compute,
      notify: NOOP,
    };

    const computed = (() => {
      // Treat computed exactly like a signal for dependency tracking
      // Register with current consumer FIRST (like signals do)
      const consumer = ctx.currentConsumer;

      // Always link if there's a consumer
      // Create edge to consumer
      if (consumer) trackDependency(node, consumer);
      
      // Fast-path: Only call pullUpdates if node needs updating
      if (node.flags & STATUS_PENDING) pullUpdates(node);

      return node.value;
    }) as ComputedFunction<T>;

    computed.peek = () => {
      // Non-tracking Read
      // Always prevent dependency tracking for peek
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = null; // Prevent ALL dependency tracking

      try {
        // Fast-path: Only call pullUpdates if node needs updating
        if (node.flags & STATUS_PENDING) pullUpdates(node);
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
