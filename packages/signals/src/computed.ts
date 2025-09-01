/**
 * ALGORITHM: Lazy Computed Values with Push-Pull Reactivity
 * 
 * Computed values are the heart of the reactive system.
 */

import { CONSTANTS, createFlagManager } from './constants';
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
  STATUS_CLEAN,
  STATUS_DIRTY,
  STATUS_RECOMPUTING,
  HAS_CHANGED,
  MASK_STATUS_AWAITING,
  MASK_STATUS_PROCESSING,
} = CONSTANTS;

const { setStatus, hasAnyOf } = createFlagManager();

interface ComputedFactoryContext extends SignalContext {
  graph: DependencyGraph;
}

// BACKWARDS COMPATIBILITY: Export interface alias
export type ComputedInterface<T = unknown> = ComputedFunction<T>;

export function createComputedFactory(ctx: ComputedFactoryContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>> {
  const {
    graph: { addEdge, pruneStale, checkStale },
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
      _callback: compute,
    };

    // Create recompute that captures state in closure
    const recompute = (): boolean => {
      // Cache initial flags and transition to recomputing state
      state._flags = setStatus(state._flags, STATUS_RECOMPUTING);

      // Reset tail marker to start fresh tracking (like alien-signals startTracking)
      // This allows new dependencies to be established while keeping old edges for cleanup
      state._inTail = undefined;

      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = state;

      let valueChanged = false;
      try {
        const oldValue = state.value;
        const newValue = compute();

        // Update value and determine final state
        if (newValue !== oldValue) {
          state.value = newValue;
          valueChanged = true;
          // Transition to clean state and add HAS_CHANGED property
          state._flags = STATUS_CLEAN | HAS_CHANGED;
        } else {
          // Value didn't change - just transition back to clean state
          valueChanged = false;
          state._flags = setStatus(state._flags, STATUS_CLEAN);
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
      // Single-pass update using checkStale
      // Check flags inline to avoid function call overhead
      const flags = state._flags;
      // Skip if already clean or currently in progress
      if (hasAnyOf(flags, MASK_STATUS_AWAITING) && !hasAnyOf(flags, MASK_STATUS_PROCESSING)) {
        checkStale(state);
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
