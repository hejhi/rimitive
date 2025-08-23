/**
 * ALGORITHM: Lazy Computed Values with Push-Pull Reactivity
 * 
 * Computed values are the heart of the reactive system.
 */

import { CONSTANTS } from './constants';
import { ProducerNode, ConsumerNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { DependencySweeper } from './helpers/dependency-sweeper';
import type { SignalContext } from './context';

// Single function interface for both read and peek
// The function also implements ProducerNode and ConsumerNode to expose graph properties
export interface ComputedFunction<T = unknown> extends ProducerNode, ConsumerNode {
  (): T;                    // Read operation (tracks dependencies)
  peek(): T;                // Non-tracking read
}

// Internal computed state that gets bound to the function
interface ComputedState<T> extends ProducerNode, ConsumerNode {
  __type: 'computed';
  _updateValue(): boolean; // Update the computed value when dependencies change
  _callback: () => T; // User's computation function
  value: T | undefined; // Cached computed value
}

const {
  RUNNING,
  STALE,
  INVALIDATED,
} = CONSTANTS;

interface ComputedFactoryContext extends SignalContext {
  graph: DependencyGraph;
  sourceCleanup: DependencySweeper;
}

// BACKWARDS COMPATIBILITY: Export interface alias
export type ComputedInterface<T = unknown> = ComputedFunction<T>;

const INVALID_STALE = STALE | INVALIDATED

export function createComputedFactory(ctx: ComputedFactoryContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>> {
  const {
    graph: { addEdge, nodeIsStale },
    sourceCleanup: { pruneStale },
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
      _flags: STALE,
      // This will be set below
      _updateValue: null as unknown as () => boolean,
      _callback: compute,
    };

    // Create updateValue that captures state in closure
    const updateValue = (): boolean => {
      // SETUP: Prepare for recomputation
      const flags = state._flags;
      
      // Set RUNNING, clear INVALIDATED, keep STALE for first-eval check
      state._flags = (flags | RUNNING) & ~INVALIDATED;

      // DEPENDENCY TRACKING SETUP:
      ctx.trackingVersion++;
      state._inTail = undefined;

      // Make this computed the "current consumer" so signals know to link to us
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = state;

      let valueChanged = false;
      try {
        const oldValue = state.value;
        const newValue = compute();

        // Check if value changed and update accordingly
        if (newValue !== oldValue) {
          state.value = newValue;
          // Mark dirty unless this is first evaluation (STALE flag indicates first eval)
          state._dirty = (flags & STALE) === 0;
          valueChanged = true;
        } else {
          // Value unchanged - clear dirty flag
          state._dirty = false;
        }
      } finally {
        // CLEANUP: Must run even if computation throws
        ctx.currentConsumer = prevConsumer;
        
        // Clear RUNNING and STALE flags
        state._flags &= ~(RUNNING | STALE);

        // Remove stale dependencies
        pruneStale(state);
      }
      
      return valueChanged;
    };

    const updateComputed = (): void => {
      // RE-ENTRANCE GUARD: Prevent infinite recursion
      if (state._flags & RUNNING) return;

      // Just check if we need to recompute
      // STALE means definitely need to recompute
      // INVALIDATED means maybe - check dependencies
      if (state._flags & STALE) {
        updateValue();
        return;
      }
      
      if (state._flags & INVALIDATED) {
        // PULL
        // Check if any dependencies actually changed
        if (nodeIsStale(state)) {
          updateValue();
        } else {
          // Dependencies haven't changed, just clear invalidated flag
          state._flags &= ~INVALIDATED;
        }
      }
    };

    const computed = (() => {
      // Treat computed exactly like a signal for dependency tracking
      // Register with current consumer FIRST (like signals do)
      const consumer = ctx.currentConsumer;

      if (consumer && consumer._flags & RUNNING) addEdge(state, consumer, ctx.trackingVersion);

      // Lazy Evaluation - only recompute if stale
      if (state._flags & INVALID_STALE) updateComputed();

      return state.value;
    }) as ComputedFunction<T>;

    // Add peek method using closure
    computed.peek = () => {
      // ALGORITHM: Non-tracking Read
      // Same as value getter but doesn't register dependencies
      if (state._flags & INVALID_STALE) updateComputed();
      return state.value!;
    };

    // Set internal method
    state._updateValue = updateValue;

    return computed;
  }

  return {
    name: 'computed',
    method: createComputed
  };
}
