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
import { Edge, Readable, ProducerNode, Disposable, ConsumerNode, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { DependencySweeper } from './helpers/dependency-sweeper';
import type { SignalContext } from './context';
import type { GraphWalker } from './helpers/graph-walker';
import type { WorkQueue } from './helpers/work-queue';
// no-op import removed: dev-only cycle detection eliminated

export interface ComputedInterface<T = unknown>
  extends Readable<T>,
    ProducerNode,
    ConsumerNode,
    Disposable {
  __type: 'computed';
  readonly value: T; // Getter triggers lazy evaluation
  peek(): T; // Non-tracking read (still evaluates if needed)
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
  graphWalker: GraphWalker;
  workQueue: WorkQueue;
}

export function createComputedFactory(ctx: ComputedFactoryContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>> {
  const {
    dependencies: { link, refreshConsumers },
    sourceCleanup: { detachAll, pruneStale },
    graphWalker: { dfs },
    workQueue: { enqueue },
  } = ctx;
  
  // Pre-bind notification handler for hot path
  const notifyNode = (node: ConsumerNode): void => {
    if ('_nextScheduled' in node) enqueue(node as ScheduledNode);
  };
  
  // PATTERN: Closure-based Factory with Bound Methods (Alien Signals approach)
  // Using factory functions with bound methods attached to plain objects:
  // - No prototype chain, methods are directly on the object
  // - Closures capture context instead of using 'this'
  // - Plain objects instead of class instances
  function createComputed<T>(compute: () => T): ComputedInterface<T> {
    // Create plain object to hold the computed data
    const computed: ComputedInterface<T> = {
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
      value: null as unknown as T,
      peek: null as unknown as (() => T),
      dispose: null as unknown as (() => void),
      _invalidate: null as unknown as (() => void),
      _updateValue: null as unknown as (() => boolean),
    };

    // ALGORITHM: Bound Value Getter Method
    function getValue(this: ComputedInterface<T>): T {
      // OPTIMIZATION: Fast path for non-tracking reads
      // Most reads happen outside of computed/effect context
      const consumer = ctx.currentConsumer;
      if (!consumer) {
        updateComputed();
        return computed._value!;
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
      if (isTracking) link(computed, consumer, computed._version);

      // Value is guaranteed to be defined after _update
      return computed._value!;
    }

    // ALGORITHM: Bound Peek Method
    function peek(this: ComputedInterface<T>): T {
      // ALGORITHM: Non-tracking Read
      // Same as value getter but doesn't register dependencies
      // Useful for conditional checks that shouldn't create dependencies
      updateComputed();
      return computed._value!;
    }

    // ALGORITHM: Bound Invalidate Method
    function invalidateComputed(this: ComputedInterface<T>): void {
      // ALGORITHM: Invalidation Guard
      // Skip if already notified (avoid redundant traversal)
      // Skip if disposed (node is dead)
      // Skip if running (will see changes when done)
      if (computed._flags & (INVALIDATED | DISPOSED | RUNNING)) return;

      // Mark as invalidated
      computed._flags |= INVALIDATED;

      // ALGORITHM: Delegated Propagation via GraphWalker
      // Use the centralized graph traversal system
      if (!computed._out) return;

      // Use GraphWalker's optimized DFS traversal
      // This handles fast paths, stack management, and flag checking
      dfs(computed._out, notifyNode);
    }

    // ALGORITHM: Bound Update Method
    function updateComputed(): void {
      // OPTIMIZATION: Combined flag and version check
      // Most common case: already updated this global version
      if (computed._verifiedVersion === ctx.version) return;

      // RE-ENTRANCE GUARD: Check RUNNING after version check (less common)
      if (computed._flags & RUNNING) return;

      // ALGORITHM: Conditional Recomputation
      // Check STALE flag first (common case) or check dependencies if INVALIDATED
      // Skip refreshing all consumers.
      if (computed._flags & STALE) {
        updateValue();
        return;
      }

      // TODO: Why do we need to call updateValue() after calling refreshConsumers, which...
      // already calls updateValue() internally? Why can't we just call refreshConsumers(computed) and be done?
      // Removing this duplicate call causes tests to fail.
      if (refreshConsumers(computed)) updateValue();
    }

    // ALGORITHM: Bound UpdateValue Method
    function updateValue(): boolean {
      // ALGORITHM: Atomic Flag Update
      // Use single assignment with bitwise operations for atomicity
      // Set RUNNING, clear flags in one operation
      computed._flags = (computed._flags | RUNNING) & ~PENDING;

      // ALGORITHM: Tail-based Dependency Tracking (alien-signals approach)
      // Reset tail to undefined at start - all edges after this will be removed
      computed._inTail = undefined;

      // ALGORITHM: Context Switching for Dependency Tracking
      // Set ourselves as the current consumer so signal reads register with us
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = computed;

      try {
        // ALGORITHM: Execute User Computation
        // This may read signals/computeds, which will call addDependency
        const newValue = computed._callback();

        // ALGORITHM: Change Detection and Version Update
        // Only increment version if value actually changed
        // Exception: always update on first run (version 0) to establish initial state
        if (newValue !== computed._value || computed._version === 0) {
          computed._value = newValue;
          computed._version++;
        }

        // Cache the global version to skip future checks if nothing changes
        computed._verifiedVersion = ctx.version;
      } finally {
        // ALGORITHM: Cleanup Phase (Critical for correctness)
        // 1. Restore previous consumer context
        ctx.currentConsumer = prevConsumer;

        // 2. Clear RUNNING flag to allow future computations
        computed._flags &= ~RUNNING;

        // 3. Remove stale dependencies (dynamic dependency tracking)
        pruneStale(computed);
      }

      return true;
    }

    // ALGORITHM: Bound Dispose Method
    function dispose(): void {
      // ALGORITHM: Safe Disposal
      // Ensure idempotent disposal - can be called multiple times safely
      if (computed._flags & DISPOSED) return;

      // Mark as disposed to prevent further updates
      computed._flags |= DISPOSED;

      // Remove all edges to sources (break circular references for GC)
      detachAll(computed);

      // Clear cached value to free memory
      computed._value = undefined;

      // TODO: Should we also clear _out to help dependents?
      // Currently dependents will discover this node is disposed when they update
    }

    // PATTERN: Bind methods to the object (Alien Signals pattern)
    Object.defineProperty(computed, 'value', {
      get: getValue.bind(computed),
      enumerable: true,
      configurable: true
    });
    
    computed.peek = peek.bind(computed);
    computed._invalidate = invalidateComputed.bind(computed);
    computed._updateValue = updateValue.bind(computed);
    computed.dispose = dispose.bind(computed);

    return computed;
  }

  return {
    name: 'computed',
    method: createComputed
  };
}
