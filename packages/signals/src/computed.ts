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
import type { DependencyGraph, EdgeCache } from './helpers/dependency-graph';
import type { DependencySweeper } from './helpers/dependency-sweeper';
import type { SignalContext } from './context';
import type { WorkQueue } from './helpers/work-queue';
import type { GraphWalker } from './helpers/graph-walker';
// no-op import removed: dev-only cycle detection eliminated

export interface ComputedInterface<T = unknown> extends Readable<T>, ProducerNode, ConsumerNode, EdgeCache, Disposable {
  __type: 'computed';
  readonly value: T;  // Getter triggers lazy evaluation
  peek(): T;          // Non-tracking read (still evaluates if needed)
  dispose(): void;    // Cleanup method to break circular references
  _refresh(): boolean;  // Check if needs update without updating (preact-style)
}

const {
  RUNNING,
  DISPOSED,
  OUTDATED,
  NOTIFIED,
  TRACKING,
} = CONSTANTS;

interface ComputedFactoryContext extends SignalContext {
  workQueue: WorkQueue;
  graphWalker: GraphWalker;
  dependencies: DependencyGraph;
  sourceCleanup: DependencySweeper;
}

export function createComputedFactory(ctx: ComputedFactoryContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>> {
  const {
    workQueue: { enqueue },
    graphWalker: { walk },
    dependencies: { ensureLink, needsRecompute, hasStaleDependencies },
    sourceCleanup: { detachAll, pruneStale }
  } = ctx;
  
  // OPTIMIZATION: Pre-defined notification handler for hot path
  // Reused across all computed invalidations to avoid function allocation
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
    // Start as OUTDATED to force computation on first access.
    _flags = OUTDATED;
    
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
    
    // OPTIMIZATION: Generation Counter for Edge Cleanup
    // Incremented before each recomputation to mark "current" edges
    // Edges with generation !== this value are stale and removed
    _generation = 0;

    constructor(compute: () => T) {
      this._callback = compute;
      // FLAG: Could validate that compute is a function here
    }

    get value(): T {
      
      // ALGORITHM: Dependency Registration (Pull Phase)
      // If we're being read from within another computed/effect, register the dependency
      const consumer = ctx.currentConsumer;
      const isTracking = !!(consumer && (consumer._flags & RUNNING));

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

    _recompute(): void {
      // ALGORITHM: Atomic Flag Update
      // Use single assignment with bitwise operations for atomicity
      // Set RUNNING, clear OUTDATED and NOTIFIED in one operation
      this._flags = (this._flags | RUNNING) & ~(OUTDATED | NOTIFIED);
      
      // ALGORITHM: Generation-Based Dependency Tracking
      // Increment generation counter before recomputation
      // All edges accessed during this run will be marked with this generation
      // After recomputation, edges with old generation are removed
      this._generation++;
      
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
    }

    _invalidate(): void {
      // ALGORITHM: Invalidation Guard
      // Skip if already notified (avoid redundant traversal)
      // Skip if disposed (node is dead)
      // Skip if running (will see changes when done)
      if (this._flags & (NOTIFIED | DISPOSED | RUNNING)) return;
      
      // Mark as potentially dirty
      this._flags |= NOTIFIED;
      
      // ALGORITHM: Transitive Invalidation
      // If this computed has dependents, they might be affected too
      // Walk the graph to notify all dependent nodes
      if (this._targets) walk(this._targets, notifyNode);
    }

    _update(): void {
      // RE-ENTRANCE GUARD: If this computed is currently RUNNING (i.e.,
      // we're being re-entered through a cyclic read during recomputation),
      // return the last cached value without attempting to update. This
      // mirrors non-throwing cycle handling and prevents infinite recursion.
      if (this._flags & RUNNING || this._globalVersion === ctx.version) return;
      // OPTIMIZATION: Ultra-fast path for clean computeds
      // If our cached global version matches, NOTHING has changed globally
      // We can skip all checks - no signal changes means no flag changes
      if (this._globalVersion === ctx.version) return;
      
      // ALGORITHM: Conditional Recomputation
      // Check OUTDATED flag first (common case) or check dependencies if NOTIFIED
      if (this._flags & OUTDATED || needsRecompute(this)) this._recompute();
    }

    _refresh(): boolean {
      // ALGORITHM: Refresh Following Preact-Signals Pattern
      // This method ensures the computed is fresh, recomputing if needed
      // Returns true if the computed is fresh (almost always after calling)
      
      // If we're currently computing, we have a cycle
      if (this._flags & RUNNING) return false;
      
      // If we have the TRACKING flag and are not OUTDATED or NOTIFIED, we're fresh
      // TRACKING means we have subscribers and are part of the active graph
      if ((this._flags & (OUTDATED | NOTIFIED | TRACKING)) === TRACKING) return true;
      
      // Clear NOTIFIED and OUTDATED flags as we're handling them now
      this._flags &= ~(NOTIFIED | OUTDATED);
      
      // OPTIMIZATION: Global version check
      // If nothing changed globally since we last updated, we're fresh
      if (this._globalVersion === ctx.version) return true;
      
      // Set RUNNING flag to detect cycles during dependency checking
      this._flags |= RUNNING;
      
      // If we have a valid cached value, check if dependencies changed
      if (this._version > 0 && !hasStaleDependencies(this)) {
        this._flags &= ~RUNNING;
        // Only cache global version after confirming we're actually clean
        this._globalVersion = ctx.version;
        return true;
      }
      
      // Dependencies changed or first run - clear RUNNING before recompute
      this._flags &= ~RUNNING;
      
      // Recompute the value
      this._recompute();
      
      // After recomputation, we're fresh
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
