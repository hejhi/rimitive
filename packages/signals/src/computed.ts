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
import type { SignalContext } from './context';
import { Edge, Readable, ProducerNode, StatefulNode, Disposable } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createDependencyHelpers, EdgeCache } from './helpers/dependency-tracking';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';
import { createGraphTraversalHelpers } from './helpers/graph-traversal';
import { createScheduledConsumerHelpers } from './helpers/scheduled-consumer';

export interface ComputedInterface<T = unknown> extends Readable<T>, ProducerNode, EdgeCache, StatefulNode, Disposable {
  __type: 'computed';
  readonly value: T;  // Getter triggers lazy evaluation
  peek(): T;          // Non-tracking read (still evaluates if needed)
  dispose(): void;    // Cleanup method to break circular references
}

const {
  RUNNING,
  DISPOSED,
  OUTDATED,
  NOTIFIED,
  IS_COMPUTED,
} = CONSTANTS;

export function createComputedFactory(ctx: SignalContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>> {
  // Helper functions for managing the dependency graph
  const depHelpers = createDependencyHelpers();
  const { addDependency, shouldNodeUpdate } = depHelpers
  
  // Helpers for cleaning up stale dependencies after recomputation
  const { disposeAllSources, cleanupSources } =
    createSourceCleanupHelpers(depHelpers);
    
  // Scheduling helpers (computeds don't use these directly, but need for traversal)
  const scheduledConsumerHelpers = createScheduledConsumerHelpers(ctx);
  
  // Graph traversal for propagating invalidations to dependents
  const { traverseAndInvalidate } = createGraphTraversalHelpers(ctx, scheduledConsumerHelpers);
  
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
    // IS_COMPUTED distinguishes us from effects for different handling.
    _flags = OUTDATED | IS_COMPUTED;
    
    // Linked list of edges pointing to our dependents (computeds/effects that read us)
    _targets: Edge | undefined = undefined;
    
    // OPTIMIZATION: Edge Cache
    // Same optimization as signals - cache last edge for repeated access
    _lastEdge: Edge | undefined = undefined;
    
    // ALGORITHM: Local Version Counter
    // Incremented only when our computed value actually changes.
    // This enables dependents to skip recomputation if we didn't change.
    _version = 0;
    
    // OPTIMIZATION: Global Version Cache
    // Stores ctx.version when we last verified we're up-to-date.
    // If global version hasn't changed, we can skip all dependency checks.
    // -1 means "never checked" to force first update.
    // INSIGHT: This turns nested dependency checks from O(depth) to O(1)!
    _globalVersion = -1;

    constructor(compute: () => T) {
      this._callback = compute;
      // FLAG: Could validate that compute is a function here
    }

    get value(): T {
      // ALGORITHM: Cycle Detection
      // If we're already computing this value, we have a circular dependency
      // This prevents infinite recursion in cases like: a = computed(() => b.value + 1); b = computed(() => a.value + 1)
      if (this._flags & RUNNING) throw new Error('Cycle detected');
      
      // ALGORITHM: Dependency Registration (Pull Phase)
      // If we're being read from within another computed/effect, register the dependency
      const consumer = ctx.currentConsumer;
      if (consumer && '_flags' in consumer && typeof consumer._flags === 'number' && consumer._flags & RUNNING) {
        addDependency(this, consumer, this._version);
      }
      
      // ALGORITHM: Lazy Evaluation
      // Only recompute if our dependencies have changed
      this._update();
      
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
      
      // ALGORITHM: Dependency Discovery Preparation
      // Mark all current dependencies with version -1
      // After recomputation, any dependency still at -1 wasn't accessed
      // and will be removed during cleanup (dynamic dependency tracking)
      let source = this._sources;
      while (source) {
        source.version = -1;
        source = source.nextSource;
      }
      
      // ALGORITHM: Context Switching for Dependency Tracking
      // Set ourselves as the current consumer so signal reads register with us
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;
      
      try {
        const oldValue = this._value;
        
        // ALGORITHM: Execute User Computation
        // This may read signals/computeds, which will call addDependency
        const newValue = this._callback();
        
        // ALGORITHM: Change Detection and Version Update
        // Only increment version if value actually changed
        // Exception: always update on first run (version 0) to establish initial state
        if (newValue !== oldValue || this._version === 0) {
          this._value = newValue;
          this._version++;
          // FLAG: Using === equality like signals - objects need immutable updates
        }
        
        // Cache the global version to skip future checks if nothing changes
        this._globalVersion = ctx.version;
      } finally {
        // ALGORITHM: Cleanup Phase (Critical for correctness)
        // 1. Restore previous consumer context
        ctx.currentConsumer = prevConsumer;
        
        // 2. Clear RUNNING flag to allow future computations
        this._flags &= ~RUNNING;
        
        // 3. Remove stale dependencies (those with version -1)
        // This implements dynamic dependency tracking - dependencies can change between runs
        cleanupSources(this);
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
      // Propagate the invalidation through the graph
      if (this._targets) traverseAndInvalidate(this._targets);
    }

    _update(): void {
      // OPTIMIZATION: Ultra-fast path for clean computeds
      // If our cached global version matches and we're not flagged dirty,
      // we can skip all checks - this is the most common case in stable UIs
      if (this._globalVersion === ctx.version && !(this._flags & (OUTDATED | NOTIFIED))) {
        return;
      }
      
      // ALGORITHM: Conditional Recomputation
      // shouldNodeUpdate checks:
      // 1. If we're already clean (via global version)
      // 2. If we're OUTDATED (definitely need update)
      // 3. If we're NOTIFIED (check dependencies recursively)
      // Only recompute if actually necessary
      if (shouldNodeUpdate(this, ctx)) {
        this._recompute();
      }
    }


    dispose(): void {
      // ALGORITHM: Safe Disposal
      // Ensure idempotent disposal - can be called multiple times safely
      if (this._flags & DISPOSED) return;
      
      // Mark as disposed to prevent further updates
      this._flags |= DISPOSED;
      
      // Remove all edges to sources (break circular references for GC)
      disposeAllSources(this);
      
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
