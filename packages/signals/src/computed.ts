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
      _in: undefined,  // Will be set to old edges when they exist
      _inTail: undefined,  // Don't clear during recompute - preserve for traversal
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
      state._flags = (initialFlags | RUNNING) & ~(DIRTY | INVALIDATED);

      // Reset tail marker to start fresh tracking (like alien-signals startTracking)
      // This allows new dependencies to be established while keeping old edges for cleanup
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
          // Clear RUNNING
          const flags = state._flags & ~RUNNING;

          // Only set VALUE_CHANGED if not already set (tracks if ever changed from initial undefined)
          if (!(flags & VALUE_CHANGED)) {
            state._flags = flags | VALUE_CHANGED;
          } else {
            state._flags = flags;
          }
        } else {
          // Value didn't change - only clear RUNNING (keep VALUE_CHANGED if it was set)
          valueChanged = false;
          state._flags &= ~RUNNING;
        }
      } finally {
        ctx.currentConsumer = prevConsumer;
        // Only prune if we have edges to prune
        // Unobserved computeds have no edges, so skip the pruning
        // Call pruneStale to remove stale edges
        if (state._in) pruneStale(state);
      }
      return valueChanged;
    };

    const update = () => {
      // Lazy Evaluation with push-pull hybrid
      // DIRTY: needs recomputation
      if (state._flags & DIRTY) recompute();
      // INVALIDATED: might need recomputation, use pull-based check
      else if (state._flags & INVALIDATED) {
        // Pull-based depedency check staleness AND refresh
        // This updates intermediate computeds during traversal
        // If dependencies changed, need to recompute this node too
        if (isStale(state)) recompute();
        else state._flags = state._flags & ~INVALIDATED; // Just clear INVALIDATED
      }
    }

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
