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
  _lastEdge: Edge | undefined; // Edge cache optimization  
  _verifiedVersion: number; // Cached global version for fast path
}

const {
  RUNNING,
  DISPOSED,
  STALE,
  INVALIDATED,
  PENDING,
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
  
  // PATTERN: Closure-based Factory with Bound Methods (Alien Signals approach)
  // Using factory functions with bound methods attached to plain objects:
  // - No prototype chain, methods are directly on the object
  // - Closures capture context instead of using 'this'
  // - Plain objects instead of class instances
  function createComputed<T>(compute: () => T): ComputedFunction<T> {
    // Forward declare the computed function for closure capture
    let computedFunction: ComputedFunction<T>;
    
    // Create plain object to hold the computed data
    const state: ComputedState<T> = {
      __type: 'computed' as const,
      _callback: compute,
      _value: undefined as T | undefined,
      _in: undefined as Edge | undefined,
      _inTail: undefined as Edge | undefined,
      _outTail: undefined as Edge | undefined,
      _flags: STALE,
      _out: undefined as Edge | undefined,
      _lastEdge: undefined as Edge | undefined,
      _version: 0,
      _verifiedVersion: -1,
      // These will be added by bind methods below
      dispose: null as unknown as (() => void),
      _invalidate: null as unknown as (() => void),
      _updateValue: null as unknown as (() => boolean),
    };

    // ALIEN-SIGNALS PATTERN: Computed operation function that will be bound to state
    function computedOper(this: ComputedState<T>): T {
      // OPTIMIZATION: Fast path for non-tracking reads
      // Most reads happen outside of computed/effect context
      const consumer = ctx.currentConsumer;
      if (!consumer) {
        updateComputed();
        return this._value!;
      }

      // ALGORITHM: Dependency Registration (Pull Phase)
      // If we're being read from within another computed/effect, register the dependency
      const isTracking = !!(consumer._flags & RUNNING);

      // ALGORITHM: Lazy Evaluation
      // Only recompute if our dependencies have changed
      updateComputed();

      // ALGORITHM: Post-Update Edge Synchronization
      // If we have a consumer, (now) register/update the dependency edge
      // Doing this once avoids redundant edge work on the hot path.
      if (isTracking) link(this, consumer, this._version);

      // Value is guaranteed to be defined after _update
      return this._value!;
    }

    // ALIEN-SIGNALS PATTERN: Non-tracking peek function
    function peekOper(this: ComputedState<T>): T {
      // ALGORITHM: Non-tracking Read
      // Same as value getter but doesn't register dependencies
      // Useful for conditional checks that shouldn't create dependencies
      updateComputed();
      return this._value!;
    }

    // ALGORITHM: Bound Invalidate Method
    function invalidateComputed(this: ComputedState<T>): void {
      // ALGORITHM: Invalidation Guard
      // Skip if already notified (avoid redundant traversal)
      // Skip if disposed (node is dead)
      // Skip if running (will see changes when done)
      if (this._flags & (INVALIDATED | DISPOSED | RUNNING)) return;

      // Mark as invalidated
      this._flags |= INVALIDATED;

      // ALGORITHM: Lazy Invalidation (alien-signals pattern)
      // Computed values do NOT propagate invalidation to their dependents.
      // This is a key performance optimization - dependents will check
      // this computed when they need it, not eagerly.
      // Only effects need immediate notification, and they're handled
      // by the signal that changed, not intermediate computeds.
    }

    // ALGORITHM: Bound Update Method
    function updateComputed(): void {
      // OPTIMIZATION: Combined flag and version check
      // Most common case: already updated this global version
      if (state._verifiedVersion === ctx.version) return;

      // RE-ENTRANCE GUARD: Check RUNNING after version check (less common)
      if (state._flags & RUNNING) return;

      // ALGORITHM: Conditional Recomputation
      // Check STALE flag first (common case) or check dependencies if INVALIDATED
      // Skip refreshing all consumers.
      if (state._flags & STALE) {
        state._updateValue();
        return;
      }

      // TODO: Why do we need to call updateValue() after calling refreshConsumers, which...
      // already calls updateValue() internally? Why can't we just call refreshConsumers(state) and be done?
      // Removing this duplicate call causes tests to fail.
      if (refreshConsumers(state)) state._updateValue();
    }

    // Removed duplicate updateValue - using updateValueImpl instead

    // ALGORITHM: Bound Dispose Method
    function dispose(this: ComputedState<T>): void {
      // ALGORITHM: Safe Disposal
      // Ensure idempotent disposal - can be called multiple times safely
      if (this._flags & DISPOSED) return;

      // Mark as disposed to prevent further updates
      this._flags |= DISPOSED;

      // Remove all edges to sources (break circular references for GC)
      detachAll(this);

      // Clear cached value to free memory
      this._value = undefined;

      // TODO: Should we also clear _out to help dependents?
      // Currently dependents will discover this node is disposed when they update
    }

    // ALIEN-SIGNALS CORE: Bind the operation function to the state object
    // The bound function IS the computed - clean and simple
    computedFunction = computedOper.bind(state) as ComputedFunction<T>;
    
    // Add the peek method with proper typing
    computedFunction.peek = peekOper.bind(state);
    
    // Create updateValue that captures the function reference
    const updateValueImpl = function(): boolean {
      // ALGORITHM: Atomic Flag Update
      // Use single assignment with bitwise operations for atomicity
      // Set RUNNING, clear flags in one operation
      state._flags = (state._flags | RUNNING) & ~PENDING;

      // ALGORITHM: Tail-based Dependency Tracking (alien-signals approach)
      // Reset tail to undefined at start - all edges after this will be removed
      state._inTail = undefined;

      // ALGORITHM: Context Switching for Dependency Tracking
      // Set the computed state as the current consumer so signal reads register with us
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = state;

      try {
        // ALGORITHM: Execute User Computation
        // This may read signals/computeds, which will call addDependency
        const newValue = state._callback();

        // ALGORITHM: Change Detection and Version Update
        // Only increment version if value actually changed
        // Exception: always update on first run (version 0) to establish initial state
        if (newValue !== state._value || state._version === 0) {
          state._value = newValue;
          state._version++;
        }

        // Cache the global version to skip future checks if nothing changes
        state._verifiedVersion = ctx.version;
      } finally {
        // ALGORITHM: Cleanup Phase (Critical for correctness)
        // 1. Restore previous consumer context
        ctx.currentConsumer = prevConsumer;

        // 2. Clear RUNNING flag to allow future computations
        state._flags &= ~RUNNING;

        // 3. Remove stale dependencies (dynamic dependency tracking)
        pruneStale(state);
      }

      return true;
    };
    
    // Bind internal methods to the state object
    state._invalidate = invalidateComputed.bind(state);
    state._updateValue = updateValueImpl;
    state.dispose = dispose.bind(state);
    
    // Add the dispose method to the function
    computedFunction.dispose = dispose.bind(state);
    
    // ALIEN-SIGNALS PATTERN: No properties on the function!
    // The state object is used directly by the dependency graph.
    // The function is just the public API.

    return computedFunction;
  }

  return {
    name: 'computed',
    method: createComputed
  };
}
