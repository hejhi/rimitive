/**
 * ALGORITHM: Lazy Computed Values with Push-Pull Reactivity
 * 
 * Computed values are the heart of the reactive system.
 */

import { CONSTANTS } from './constants';
import { DerivedNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { DependencySweeper } from './helpers/dependency-sweeper';
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
  sourceCleanup: DependencySweeper;
}

// BACKWARDS COMPATIBILITY: Export interface alias
export type ComputedInterface<T = unknown> = ComputedFunction<T>;

const INVALID_DIRTY = DIRTY | INVALIDATED

export function createComputedFactory(ctx: ComputedFactoryContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>> {
  const {
    graph: { addEdge, isStale },
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
      _flags: DIRTY,
      // This will be set below
      _recompute: null as unknown as () => boolean,
      _callback: compute,
    };

    // Create recompute that captures state in closure
    const recompute = (): boolean => {
      const flags = state._flags;

      // Bitwise logic in one line for clarity and optimization
      state._flags = (flags | RUNNING) & ~INVALIDATED;

      ctx.trackingVersion++;
      state._inTail = undefined;

      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = state;

      let valueChanged = false;
      try {
        const oldValue = state.value;
        const newValue = compute();

        // Avoid multiple flag checks; assign only once
        if (newValue !== oldValue) {
          state.value = newValue;
          state._dirty = (flags & DIRTY) === 0;
          valueChanged = true;
        } else state._dirty = false;
      } finally {
        ctx.currentConsumer = prevConsumer;
        // Bitwise clean up in one shot
        state._flags &= ~(RUNNING | DIRTY);
        pruneStale(state); // Ensure pruneStale is consistently shaped and inlinable
      }
      return valueChanged;
    };

    const updateComputed = (): void => {
      // RE-ENTRANCE GUARD: Prevent infinite recursion
      if (state._flags & RUNNING) return;

      // Just check if we need to recompute
      // DIRTY means definitely need to recompute
      // INVALIDATED means maybe - check dependencies
      if (state._flags & DIRTY) {
        recompute();
        return;
      }
      
      if (state._flags & INVALIDATED) {
        // PULL
        // Check if any dependencies actually changed
        if (isStale(state)) recompute();
        // Dependencies haven't changed, just clear invalidated flag
        else state._flags &= ~INVALIDATED;
      }
    };

    const computed = (() => {
      // Treat computed exactly like a signal for dependency tracking
      // Register with current consumer FIRST (like signals do)
      const consumer = ctx.currentConsumer;

      if (consumer && consumer._flags & RUNNING) addEdge(state, consumer, ctx.trackingVersion);

      // Lazy Evaluation - only recompute if stale
      if (state._flags & INVALID_DIRTY) updateComputed();

      return state.value;
    }) as ComputedFunction<T>;

    // Add peek method using closure
    computed.peek = () => {
      // ALGORITHM: Non-tracking Read
      // Same as value getter but doesn't register dependencies
      if (state._flags & INVALID_DIRTY) updateComputed();
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
