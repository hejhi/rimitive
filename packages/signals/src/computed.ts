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
  _recompute(): boolean; // Update the computed value when dependencies change
  value: T | undefined; // Cached computed value
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
    // State object captured in closure - no binding needed
    const state: ComputedState<T> = {
      __type: 'computed' as const,
      value: undefined,
      _out: undefined,
      _outTail: undefined,
      _in: undefined, // Will be set to old edges when they exist
      _inTail: undefined, // Don't clear during recompute - preserve for traversal
      _flags: STATUS_DIRTY, // Start in DIRTY state so first access triggers computation
      // This will be set below
      _recompute: null as unknown as () => boolean,
    };

    // Create recompute that captures state in closure
    const recompute = (): boolean => {
      // Reset tail marker to start fresh tracking (like alien-signals startTracking)
      // This allows new dependencies to be established while keeping old edges for cleanup
      state._inTail = undefined;

      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = state;

      let valueChanged = false;

      try {
        const oldValue = state.value;
        const newValue = compute();

        // Update value and return whether it changed
        if (newValue !== oldValue) {
          state.value = newValue;
          valueChanged = true;
        }
      } finally {
        ctx.currentConsumer = prevConsumer;
        // Only prune if we have edges to prune
        // Unobserved computeds have no edges, so skip the pruning
        if (state._in) pruneStale(state);
      }
      return valueChanged;
    };

    // Single-pass update using pullUpdates
    const update = () => pullUpdates(state);

    const computed = (() => {
      // Treat computed exactly like a signal for dependency tracking
      // Register with current consumer FIRST (like signals do)
      const consumer = ctx.currentConsumer;

      // Always link if there's a consumer
      // Create edge to consumer
      if (consumer) addEdge(state, consumer);

      update();

      return state.value;
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

      return state.value!;
    };

    // Set internal method
    state._recompute = recompute;

    return computed;
  }

  return {
    name: 'computed',
    method: createComputed,
  };
}
