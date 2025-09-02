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

const {
  STATUS_DIRTY,
} = CONSTANTS;

// BACKWARDS COMPATIBILITY: Export interface alias
export type ComputedInterface<T = unknown> = ComputedFunction<T>;

export function createComputedFactory(
  ctx: ComputedContext
): LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>> {
  const {
    graphEdges: { addEdge, pruneStale },
    pullPropagator: { pullUpdates },
  } = ctx;

  function createComputed<T>(compute: () => T): ComputedFunction<T> {
    const node: ComputedState<T> = {
      __type: 'computed' as const,
      value: undefined as T,
      out: undefined,
      outTail: undefined,
      in: undefined, // Will be set to old edges when they exist
      inTail: undefined, // Don't clear during recompute - preserve for traversal
      flags: STATUS_DIRTY, // Start in DIRTY state so first access triggers computation
      // This will be set below
      recompute(): boolean {
        // Reset tail marker to start fresh tracking (like alien-signals startTracking)
        // This allows new dependencies to be established while keeping old edges for cleanup
        node.inTail = undefined;

        const prevConsumer = ctx.currentConsumer;
        ctx.currentConsumer = node;

        let valueChanged = false;

        try {
          const oldValue = node.value;
          const newValue = compute();

          // Update value and return whether it changed
          if (newValue !== oldValue) {
            node.value = newValue;
            valueChanged = true;
          }
        } finally {
          ctx.currentConsumer = prevConsumer;
          // Only prune if we have edges to prune
          // Unobserved computeds have no edges, so skip the pruning
          if (node.in) pruneStale(node);
        }
        return valueChanged;
      },
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
      if (consumer) addEdge(node, consumer);

      update();

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
