/**
 * ALGORITHM: Lazy Computed Values with Push-Pull Reactivity
 * 
 * Computed values are the heart of the reactive system.
 */

import { CONSTANTS } from './constants';
import { DerivedNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { SignalContext } from './context';

// Single function interface for both read and peek
// The function also implements ProducerNode and ConsumerNode to expose graph properties
export interface ComputedFunction<T = unknown> extends DerivedNode {
  (): T;                    // Read operation (tracks dependencies)
  peek(): T;                // Non-tracking read
}

// Internal computed state that gets bound to the function
interface ComputedState<T> extends DerivedNode {
  __type: 'computed';
  _recompute(): boolean; // Update the computed value when dependencies change
  _callback: () => T; // User's computation function
  value: T | undefined; // Cached computed value
}

const {
  RUNNING,
  DIRTY,
  INVALIDATED,
  VALUE_CHANGED,
} = CONSTANTS;

interface ComputedFactoryContext extends SignalContext {
  graph: DependencyGraph;
}

// BACKWARDS COMPATIBILITY: Export interface alias
export type ComputedInterface<T = unknown> = ComputedFunction<T>;

const DIRTY_OR_INVALIDATED = DIRTY | INVALIDATED;

export function createComputedFactory(ctx: ComputedFactoryContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>> {
  const {
    graph: { addEdge, pruneStale, isStale },
  } = ctx;
  
  function createComputed<T>(compute: () => T): ComputedFunction<T> {
    // State object captured in closure - no binding needed
    const state: ComputedState<T> = {
      __type: 'computed' as const,
      value: undefined,
      _out: undefined,
      _outTail: undefined,
      _in: undefined,
      _inTail: undefined,
      _flags: DIRTY,  // Start with DIRTY flag so first access triggers computation
      // This will be set below
      _recompute: null as unknown as () => boolean,
      _callback: compute,
    };

    // Create recompute that captures state in closure
    const recompute = (): boolean => {
      // Cache initial flags and compute new flags in one operation
      const initialFlags = state._flags;
      // Set RUNNING, clear DIRTY and INVALIDATED in single assignment
      state._flags = (initialFlags | RUNNING) & ~DIRTY_OR_INVALIDATED;
      state._inTail = undefined;

      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = state;

      let valueChanged = false;
      try {
        const oldValue = state.value;
        const newValue = compute();

        // Update value and determine final flag state
        if (newValue !== oldValue) {
          state.value = newValue;
          valueChanged = true;
          // Set final flags: clear RUNNING, set VALUE_CHANGED
          state._flags = (state._flags & ~RUNNING) | VALUE_CHANGED;
        } else {
          // Value didn't change - clear RUNNING and VALUE_CHANGED in one operation
          valueChanged = false;
          state._flags &= ~(RUNNING | VALUE_CHANGED);
        }
      } finally {
        ctx.currentConsumer = prevConsumer;
        // Only prune if we have edges to prune
        // Unobserved computeds have no edges, so skip the pruning
        if (state._in) pruneStale(state);
      }
      return valueChanged;
    };

    const updateComputed = (): void => {
      // RE-ENTRANCE GUARD: Prevent infinite recursion
      if (state._flags & RUNNING) return;

      // Always recompute when called - staleness check happens before calling this
      recompute();
    };

    const update = () => {
      // Lazy Evaluation with push-pull hybrid
      // DIRTY: definitely needs recomputation
      if (state._flags & DIRTY) updateComputed();
      // INVALIDATED: might need recomputation, use pull-based check
      else if (state._flags & INVALIDATED) {
        // Pull-based depedency check AND refresh in one pass
        // This updates intermediate computeds during traversal
        // If dependencies changed, need to recompute this node too
        if (isStale(state)) updateComputed();
        else state._flags = state._flags & ~INVALIDATED; // Just clear INVALIDATED
      }
    }

    const computed = (() => {
      // Treat computed exactly like a signal for dependency tracking
      // Register with current consumer FIRST (like signals do)
      const consumer = ctx.currentConsumer;

      // Always link if there's a consumer
      if (consumer && consumer._flags & RUNNING) addEdge(state, consumer);

      update();

      return state.value;
    }) as ComputedFunction<T>;

    computed.peek = () => {
      // Non-tracking Read
      // Same as read but doesn't register dependencies
      if (!state._out) {
        const prevConsumer = ctx.currentConsumer;
        ctx.currentConsumer = null; // Prevent ALL other dependency tracking

        try {
          update();
        } finally {
          ctx.currentConsumer = prevConsumer; // Restore back to previous state
        }
      } else update(); // Observed computed - normal peek behavior

      return state.value!;
    };

    // Set internal method
    state._recompute = recompute;

    return computed;
  }

  return {
    name: 'computed',
    method: createComputed
  };
}
