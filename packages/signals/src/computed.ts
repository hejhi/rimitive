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
  _onOutdated(): boolean; // Check if needs update without updating (preact-style)
}

const {
  RUNNING,
  DISPOSED,
  STALE,
  NOTIFIED,
  DIRTY_FLAGS,
} = CONSTANTS;

interface ComputedFactoryContext extends SignalContext {
  dependencies: DependencyGraph;
  sourceCleanup: DependencySweeper;
  graphWalker: GraphWalker;
  workQueue: WorkQueue;
}

export function createComputedFactory(ctx: ComputedFactoryContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>> {
  const {
    dependencies: { ensureLink, refreshConsumers },
    sourceCleanup: { detachAll, pruneStale },
    graphWalker: { dfs },
    workQueue: { enqueue },
  } = ctx;
  
  // Pre-bind notification handler for hot path
  const notifyNode = (node: ConsumerNode): void => {
    if ('_nextScheduled' in node) enqueue(node as ScheduledNode);
  };
  
  class Computed<T> implements ComputedInterface<T> {
    __type = 'computed' as const;

    // User's computation function - should be pure for best results
    _callback: () => T;

    // ALGORITHM: Memoization Cache
    // Stores the last computed value to avoid redundant computation.
    // undefined initially to force first computation.
    _value: T | undefined = undefined;

    // ALGORITHM: Dynamic Dependency List
    // Linked list of edges pointing to our dependencies (signals/computeds we read).
    // This list is rebuilt on each computation to handle conditional dependencies.
    _sources: Edge | undefined = undefined;

    // OPTIMIZATION: Initial State Flags
    // Start as STALE to force computation on first access.
    _flags = STALE;
    // Generation counter for dynamic dependency pruning
    _gen = 0;

    // Linked list of edges pointing to our dependents (computeds/effects that read us)
    _targets: Edge | undefined = undefined;

    // OPTIMIZATION: Edge Cache
    // Same optimization as signals - cache last edge for repeated access
    _lastEdge: Edge | undefined = undefined;

    // ALGORITHM: Local Version Counter
    // Incremented only when our computed value actually changes.
    // This enables dependents to skip recomputation if we didn't change.
    _version = 0;

    // CACHED GLOBAL VERSION (FAST-PATH OPTIMIZATION)
    // Caches ctx.version when this computed was last verified as up-to-date.
    // Enables the critical "nothing changed" fast path.
    //
    // PURPOSE: O(1) optimization for stable systems
    // - If _globalVersion === ctx.version, skip ALL dependency checks
    // - Turns potentially O(n) traversal into O(1) check
    // - Particularly effective for deep dependency trees
    //
    // NOT REDUNDANT: This is a performance cache that avoids traversing
    // the dependency graph when nothing has changed globally.
    // Without it, every access would need to validate all dependencies.
    _globalVersion = -1;

    // NOTE: Edge lifecycle is managed via per-edge mark bits during runs

    constructor(compute: () => T) {
      this._callback = compute;
      // FLAG: Could validate that compute is a function here
    }

    get value(): T {
      // OPTIMIZATION: Fast path for non-tracking reads
      // Most reads happen outside of computed/effect context
      const consumer = ctx.currentConsumer;
      if (!consumer) {
        this._update();
        return this._value!;
      }

      // ALGORITHM: Dependency Registration (Pull Phase)
      // If we're being read from within another computed/effect, register the dependency
      const isTracking = !!(consumer._flags & RUNNING);

      // ALGORITHM: Lazy Evaluation
      // Only recompute if our dependencies have changed
      this._update();

      // ALGORITHM: Post-Update Edge Synchronization
      // If we have a consumer, (now) register/update the dependency edge
      // Doing this once avoids redundant edge work on the hot path.
      if (isTracking) ensureLink(this, consumer, this._version);

      // Value is guaranteed to be defined after _update
      return this._value!;
    }

    peek(): T {
      // ALGORITHM: Non-tracking Read
      // Same as value getter but doesn't register dependencies
      // Useful for conditional checks that shouldn't create dependencies
      this._update();
      return this._value!;
    }

    _invalidate(): void {
      // ALGORITHM: Invalidation Guard
      // Skip if already notified (avoid redundant traversal)
      // Skip if disposed (node is dead)
      // Skip if running (will see changes when done)
      if (this._flags & (NOTIFIED | DISPOSED | RUNNING)) return;

      // Mark as potentially dirty
      this._flags |= NOTIFIED;

      // ALGORITHM: Delegated Propagation via GraphWalker
      // Use the centralized graph traversal system
      if (!this._targets) return;

      // Use GraphWalker's optimized DFS traversal
      // This handles fast paths, stack management, and flag checking
      dfs(this._targets, notifyNode);
    }

    _update(): void {
      // OPTIMIZATION: Combined flag and version check
      // Most common case: already updated this global version
      if (this._globalVersion === ctx.version) return;

      // RE-ENTRANCE GUARD: Check RUNNING after version check (less common)
      if (this._flags & RUNNING) return;

      // ALGORITHM: Conditional Recomputation
      // Check STALE flag first (common case) or check dependencies if NOTIFIED
      // Skip refreshing all consumers.
      if (this._flags & STALE) {
        this._onOutdated();
        return;
      }

      // TODO: Why do we need to call this._onOutdated() after calling refreshConsumers, which...
      // calls this.refresh()? Why can't we just call refreshConsumers(this) and be done? it causes
      // a lot of tests to fail.
      if (refreshConsumers(this)) this._onOutdated();
    }

    _onOutdated(): boolean {
      // ALGORITHM: Atomic Flag Update
      // Use single assignment with bitwise operations for atomicity
      // Set RUNNING, clear all dirty flags in one operation
      this._flags = (this._flags | RUNNING) & ~DIRTY_FLAGS;

      // Increment generation for this run; edges touched will carry this tag
      this._gen = (this._gen + 1) | 0;
      // Edges will be tagged via ensureLink; stale edges pruned after run

      // ALGORITHM: Context Switching for Dependency Tracking
      // Set ourselves as the current consumer so signal reads register with us
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;

      try {
        // ALGORITHM: Execute User Computation
        // This may read signals/computeds, which will call addDependency
        const newValue = this._callback();

        // ALGORITHM: Change Detection and Version Update
        // Only increment version if value actually changed
        // Exception: always update on first run (version 0) to establish initial state
        if (newValue !== this._value || this._version === 0) {
          this._value = newValue;
          this._version++;
        }

        // Cache the global version to skip future checks if nothing changes
        this._globalVersion = ctx.version;
      } finally {
        // ALGORITHM: Cleanup Phase (Critical for correctness)
        // 1. Restore previous consumer context
        ctx.currentConsumer = prevConsumer;

        // 2. Clear RUNNING flag to allow future computations
        this._flags &= ~RUNNING;

        // 3. Remove stale dependencies (dynamic dependency tracking)
        pruneStale(this);
      }

      return true;
    }

    dispose(): void {
      // ALGORITHM: Safe Disposal
      // Ensure idempotent disposal - can be called multiple times safely
      if (this._flags & DISPOSED) return;

      // Mark as disposed to prevent further updates
      this._flags |= DISPOSED;

      // Remove all edges to sources (break circular references for GC)
      detachAll(this);

      // Clear cached value to free memory
      this._value = undefined;

      // TODO: Should we also clear _targets to help dependents?
      // Currently dependents will discover this node is disposed when they update
    }
  }

  return {
    name: 'computed',
    method: <T>(compute: () => T): ComputedInterface<T> => new Computed(compute)
  };
}
