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

export type ComputedOpts = {
  ctx: GlobalContext;
  trackDependency: GraphEdges['trackDependency'];
  pullUpdates: PullPropagator['pullUpdates'];
};

// Re-export types for proper type inference
export type { GlobalContext } from './context';
export type { GraphEdges } from './helpers/graph-edges';
export type { PullPropagator } from './helpers/pull-propagator';

// Internal computed state that gets bound to the function
interface ComputedNode<T> extends DerivedNode {
  __type: 'computed';
  value: T;
}

const { STATUS_PENDING } = CONSTANTS;

// Export the factory return type for better type inference
export type ComputedFactory = LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>>;

export function createComputedFactory(
  opts: ComputedOpts
): ComputedFactory {
  const { ctx, trackDependency, pullUpdates } = opts;

  function createComputed<T>(compute: () => T): ComputedFunction<T> {
    const node: ComputedNode<T> = {
      __type: 'computed' as const,
      value: undefined as T,
      version: 0, // Value version for change detection
      subscribers: undefined,
      subscribersTail: undefined,
      dependencies: undefined,
      dependencyTail: undefined,
      status: STATUS_PENDING,
      trackingVersion: 0, // Initialize version tracking
      compute,
    };

    // Direct function declaration is more efficient than IIFE
    function computed(): T {
      // Update if needed FIRST (before tracking)
      // This ensures we track the post-computation version, not pre-computation
      if (node.status === STATUS_PENDING) pullUpdates(node);

      // Track dependency AFTER pulling updates
      // This way we record the actual version after any computation
      const consumer = ctx.currentConsumer;
      if (consumer) trackDependency(node, consumer);

      return node.value;
    }

    computed.peek = (): T => {
      // Save and clear consumer to prevent tracking
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = null;

      try {
        if (node.status === STATUS_PENDING) pullUpdates(node);
        return node.value;
      } finally {
        ctx.currentConsumer = prevConsumer;
      }
    };

    return computed;
  }

  return {
    name: 'computed',
    method: createComputed,
  };
}
