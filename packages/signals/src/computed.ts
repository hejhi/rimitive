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
import { Edge, ProducerNode, Disposable, ConsumerNode } from './types';
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
  dispose(): void;          // Cleanup method
}

// Internal computed state that gets bound to the function
interface ComputedState<T> extends ProducerNode, ConsumerNode, Disposable {
  __type: 'computed';
  dispose(): void; // Cleanup method to break circular references
  _updateValue(): boolean; // Update the computed value when dependencies change
  _callback: () => T; // User's computation function
  _value: T | undefined; // Cached computed value
}

const {
  RUNNING,
  DISPOSED,
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
    sourceCleanup: { detachAll, pruneStale },
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
      // These will be set below
      dispose: null as unknown as (() => void),
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

      // SIMPLIFIED: Just check if we need to recompute
      // STALE means definitely need to recompute
      // INVALIDATED means maybe - check dependencies
      if (state._flags & STALE) {
        state._updateValue();
      } else if (state._flags & INVALIDATED) {
        // Check if any dependencies actually changed
        if (refreshConsumers(state)) {
          state._updateValue();
        } else {
          // Dependencies haven't changed, just clear invalidated flag
          state._flags &= ~INVALIDATED;
        }
      }
    }

    // Removed duplicate updateValue - using updateValueImpl instead

    // Dispose method using closure
    const dispose = (): void => {
      // ALGORITHM: Safe Disposal
      // Ensure idempotent disposal - can be called multiple times safely
      if (state._flags & DISPOSED) return;

      // Mark as disposed to prevent further updates
      state._flags |= DISPOSED;

      // Remove all edges to sources (break circular references for GC)
      detachAll(state);

      // Clear cached value to free memory
      state._value = undefined;

      // TODO: Should we also clear _out to help dependents?
      // Currently dependents will discover this node is disposed when they update
    };

    // Create updateValue that captures state in closure
    const updateValueImpl = (): boolean => {
      // ALGORITHM: Atomic Flag Update
      // Use single assignment with bitwise operations for atomicity
      // Set RUNNING, clear flags in one operation
      state._flags = (state._flags | RUNNING) & ~PENDING;

      // ALGORITHM: Increment tracking version for this evaluation
      // This marks the start of a new tracking context
      ctx.trackingVersion++;

      // ALGORITHM: Tail-based Dependency Tracking (alien-signals approach)
      // Reset tail to undefined at start - all edges after this will be removed
      state._inTail = undefined;

      // ALGORITHM: Context Switching for Dependency Tracking
      // Set the computed state as the current consumer so signal reads register with us
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = state;

      let valueChanged = false;
      try {
        // SIMPLIFIED: More like signal's pattern
        const oldValue = state._value;
        const newValue = state._callback();
        
        // Check if value changed (like signals do)
        if (newValue !== oldValue) {
          // Value changed - update and mark dirty
          state._value = newValue;
          valueChanged = true;
          
          // Mark dirty only if not initial evaluation
          if (oldValue !== undefined) {
            state._dirty = true;
            
            // NOTE: We can't propagate immediately like signals because
            // computeds are lazy - our dependents will check us when they need to
          }
        } else {
          // Value unchanged - clear dirty flag
          state._dirty = false;
        }
      } finally {
        // ALGORITHM: Cleanup Phase (Critical for correctness)
        // 1. Restore previous consumer context
        ctx.currentConsumer = prevConsumer;

        // 2. Clear RUNNING flag to allow future computations
        state._flags &= ~RUNNING;

        // 3. Remove stale dependencies (dynamic dependency tracking)
        pruneStale(state);
      }

      return valueChanged;
    };
    
    // Set internal methods
    state._updateValue = updateValueImpl;
    state.dispose = dispose;

    // Add the dispose method to the function
    computed.dispose = dispose;

    return computed;
  }

  return {
    name: 'computed',
    method: createComputed
  };
}
