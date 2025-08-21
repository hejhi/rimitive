/**
 * ALGORITHM: Lazy Computed Values with Push-Pull Reactivity
 * 
 * Computed values are the heart of the reactive system, implementing several key algorithms:
 * 
 * 1. LAZY EVALUATION (Pull Algorithm):
 *    - Only recompute when accessed AND dependencies have changed
 *    - Cache results between computations for efficiency
 *    - Inspired by Haskell's lazy evaluation and spreadsheet formulas
 * 
 * 2. AUTOMATIC DEPENDENCY TRACKING (Dynamic Discovery):
 *    - Dependencies detected at runtime by intercepting signal reads
 *    - No need to declare dependencies upfront (unlike React's useEffect)
 *    - Dependencies can change between computations (conditional logic)
 * 
 * 3. PUSH-PULL HYBRID:
 *    - PUSH: Receive invalidation notifications from dependencies
 *    - PULL: Only recompute when actually accessed
 *    - Best of both worlds: eager notification, lazy computation
 * 
 * 4. DIAMOND DEPENDENCY OPTIMIZATION:
 *    - Handles diamond patterns efficiently (A -> B,C -> D)
 *    - Version tracking prevents redundant recomputation
 *    - Global version clock enables O(1) staleness checks
 * 
 * This creates a directed acyclic graph (DAG) that updates with optimal efficiency.
 * The implementation draws inspiration from:
 * - MobX computed values
 * - Vue 3's computed refs
 * - SolidJS memos
 * - Incremental computation literature
 */

import { CONSTANTS } from './constants';
import { Edge, ProducerNode, ConsumerNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { DependencySweeper } from './helpers/dependency-sweeper';
import type { SignalContext } from './context';
// no-op import removed: dev-only cycle detection eliminated

// ALIEN-SIGNALS PATTERN: Single function interface for both read and peek
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
  _value: T | undefined; // Cached computed value
}

const {
  RUNNING,
  STALE,
  PENDING,
  INVALIDATED,
} = CONSTANTS;

interface ComputedFactoryContext extends SignalContext {
  dependencies: DependencyGraph;
  sourceCleanup: DependencySweeper;
}

// BACKWARDS COMPATIBILITY: Export interface alias
export type ComputedInterface<T = unknown> = ComputedFunction<T>;

export function createComputedFactory(ctx: ComputedFactoryContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedFunction<T>> {
  const {
    dependencies: { link, refreshConsumers },
    sourceCleanup: { pruneStale },
  } = ctx;
  
  // CLOSURE PATTERN: Create computed with closure-captured state for better V8 optimization
  function createComputed<T>(compute: () => T): ComputedFunction<T> {
    // State object captured in closure - no binding needed
    const state: ComputedState<T> = {
      __type: 'computed' as const,
      _callback: compute,
      _value: undefined as T | undefined,
      _in: undefined as Edge | undefined,
      _inTail: undefined as Edge | undefined,
      _out: undefined as Edge | undefined,
      _outTail: undefined as Edge | undefined,
      _flags: STALE,
      _dirty: false,
      // This will be set below
      _updateValue: null as unknown as (() => boolean),
    };

    // Computed function using closure instead of bound this
    const computed = (() => {
      // Treat computed exactly like a signal for dependency tracking
      // Register with current consumer FIRST (like signals do)
      const consumer = ctx.currentConsumer;

      if (consumer && (consumer._flags & RUNNING)) link(state, consumer, ctx.trackingVersion);

      // Lazy Evaluation - only recompute if stale
      if (state._flags & (STALE | INVALIDATED)) updateComputed();
      
      return state._value;
    }) as ComputedFunction<T>;

    // Add peek method using closure
    computed.peek = () => {
      // ALGORITHM: Non-tracking Read
      // Same as value getter but doesn't register dependencies
      if (state._flags & (STALE | INVALIDATED)) updateComputed();
      return state._value!;
    };

    const updateComputed = (): void => {
      // RE-ENTRANCE GUARD: Prevent infinite recursion
      if (state._flags & RUNNING) return;

      // Just check if we need to recompute
      // STALE means definitely need to recompute
      // INVALIDATED means maybe - check dependencies
      if (state._flags & STALE) {
        state._updateValue();
      } else if (state._flags & INVALIDATED) {
        // PULL
        // Check if any dependencies actually changed
        if (refreshConsumers(state)) {
          state._updateValue();
        } else {
          // Dependencies haven't changed, just clear invalidated flag
          state._flags &= ~INVALIDATED;
        }
      }
    }

    // Create updateValue that captures state in closure
    const updateValueImpl = (): boolean => {
      // Check if this is the first evaluation (STALE flag is set initially)
      const isFirstEvaluation = (state._flags & STALE) !== 0;
      
      // SETUP: Prepare for recomputation
      // 1. Set RUNNING flag (prevent circular dependencies)
      // 2. Clear stale/invalidated flags
      state._flags = (state._flags | RUNNING) & ~PENDING;

      // DEPENDENCY TRACKING SETUP:
      // Each computation gets a unique version to identify its dependencies
      ctx.trackingVersion++;
      
      // Mark where current dependencies end (everything after will be removed)
      state._inTail = undefined;

      // Make this computed the "current consumer" so signals know to link to us
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = state;

      let valueChanged = false;
      try {
        const oldValue = state._value;
        const newValue = state._callback();
        
        // Check if value changed (like signals do)
        if (newValue !== oldValue) {
          // Value changed - update and mark dirty
          state._value = newValue;
          valueChanged = true;
          
          // Only mark dirty if not the first evaluation (first eval shouldn't trigger dependents)
          if (!isFirstEvaluation) state._dirty = true;
          
          // NOTE: We can't propagate immediately like signals because
          // computeds are lazy - our dependents will check us when they need to
        } else {
          // Value unchanged - clear dirty flag
          state._dirty = false;
        }
      } finally {
        // CLEANUP: Must run even if computation throws
        // 1. Restore the previous consumer (unwinding the context stack)
        ctx.currentConsumer = prevConsumer;

        // 2. Clear RUNNING flag so this computed can run again
        state._flags &= ~RUNNING;

        // 3. Remove dependencies we no longer need (dynamic dependency cleanup)
        // Any dependency NOT accessed during this run gets removed
        pruneStale(state);
      }

      return valueChanged;
    };
    
    // Set internal method
    state._updateValue = updateValueImpl;

    return computed;
  }

  return {
    name: 'computed',
    method: createComputed
  };
}
