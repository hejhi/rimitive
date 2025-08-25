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
} = CONSTANTS;

interface ComputedFactoryContext extends SignalContext {
  graph: DependencyGraph;
}

// BACKWARDS COMPATIBILITY: Export interface alias
export type ComputedInterface<T = unknown> = ComputedFunction<T>;


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
      _dirty: false,
      _in: undefined,
      _inTail: undefined,
      _flags: DIRTY,
      // This will be set below
      _recompute: null as unknown as () => boolean,
      _callback: compute,
    };

    // Create recompute that captures state in closure
    const recompute = (): boolean => {
      const flags = state._flags;

      // Set RUNNING flag and clear DIRTY and INVALIDATED
      state._flags = (flags | RUNNING) & ~(DIRTY | INVALIDATED);

      ctx.trackingVersion++;
      state._inTail = undefined;

      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = state;

      let valueChanged = false;
      try {
        const oldValue = state.value;
        const newValue = compute();

        // Update value and dirty flag based on whether value changed
        if (newValue !== oldValue) {
          state.value = newValue;
          state._dirty = true;
          valueChanged = true;
        } else {
          // Value didn't change - clear dirty flag but don't propagate
          state._dirty = false;
          valueChanged = false;
        }
      } finally {
        ctx.currentConsumer = prevConsumer;
        // Clear RUNNING flag  
        state._flags &= ~RUNNING;
        pruneStale(state); // Ensure pruneStale is consistently shaped and inlinable
      }
      return valueChanged;
    };

    const updateComputed = (): void => {
      // RE-ENTRANCE GUARD: Prevent infinite recursion
      if (state._flags & RUNNING) return;

      // Always recompute when called - staleness check happens before calling this
      recompute();
    };

    const computed = (() => {
      // Treat computed exactly like a signal for dependency tracking
      // Register with current consumer FIRST (like signals do)
      const consumer = ctx.currentConsumer;

      // Always link if there's a consumer (alien-signals approach)
      if (consumer && consumer._flags & RUNNING) {
        addEdge(state, consumer, ctx.trackingVersion);
      }

      // Lazy Evaluation with push-pull hybrid
      // DIRTY: definitely needs recomputation
      // INVALIDATED: might need recomputation, use pull-based check
      if (state._flags & DIRTY) {
        updateComputed();
      } else if (state._flags & INVALIDATED) {
        // Pull-based check for invalidated nodes
        if (isStale(state)) {
          updateComputed();
        } else {
          // Not actually stale, clear invalidated flag
          state._flags &= ~INVALIDATED;
        }
      }

      return state.value;
    }) as ComputedFunction<T>;

    // Add peek method using closure
    computed.peek = () => {
      // ALGORITHM: Non-tracking Read
      // Same as value getter but doesn't register dependencies
      // If unobserved, we may need to recompute to get current value
      if (!state._out) {
        // Unobserved computed - force recomputation to get fresh value
        // But don't establish dependency edges since this is peek()
        const prevConsumer = ctx.currentConsumer;
        ctx.currentConsumer = null;
        try {
          if (state._flags & DIRTY) {
            updateComputed();
          } else if (state._flags & INVALIDATED) {
            if (isStale(state)) {
              updateComputed();
            } else {
              state._flags &= ~INVALIDATED;
            }
          }
        } finally {
          ctx.currentConsumer = prevConsumer;
        }
      } else {
        // Observed computed - normal peek behavior
        if (state._flags & DIRTY) {
          updateComputed();
        } else if (state._flags & INVALIDATED) {
          if (isStale(state)) {
            updateComputed();
          } else {
            state._flags &= ~INVALIDATED;
          }
        }
      }
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
