/**
 * ALGORITHM: Reactive Effects with Automatic Cleanup and Batching
 * 
 * Effects are the "output nodes" of the reactive graph - they consume reactive values
 * and perform side effects. Unlike computed values, effects:
 * - Always execute eagerly when dependencies change (no lazy evaluation)
 * - Don't produce values (they're sinks, not sources)
 * - Can have cleanup functions for resource management
 * 
 * KEY ALGORITHMS:
 * 
 * 1. AUTOMATIC CLEANUP PATTERN (React-inspired):
 *    - Effects can return a cleanup function
 *    - Cleanup runs before next execution and on disposal
 *    - Prevents resource leaks (event listeners, timers, subscriptions)
 * 
 * 2. BATCHED SCHEDULING:
 *    - Effects are queued, not executed immediately
 *    - Batch completes after all sync updates finish
 *    - Prevents seeing intermediate/inconsistent states
 *    - Similar to React's batching in event handlers
 * 
 * 3. CIRCULAR BUFFER QUEUE:
 *    - Effects scheduled in a power-of-2 sized circular buffer
 *    - O(1) enqueue/dequeue operations
 *    - No array resizing or memory allocation during scheduling
 * 
 * 4. DEDUPLICATION:
 *    - Each effect scheduled at most once per batch
 *    - NOTIFIED flag prevents duplicate scheduling
 *    - Improves performance with many dependency changes
 * 
 * INSPIRATION:
 * - React useEffect (cleanup pattern, dependency tracking)
 * - MobX autorun (automatic re-execution)
 * - Vue watchEffect (immediate execution)
 * - RxJS (cleanup/disposal pattern)
 */

import { CONSTANTS } from './constants';
import { Disposable, Edge, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencySweeper } from './helpers/dependency-sweeper';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { SignalContext } from './context';

export interface EffectInterface extends ScheduledNode, Disposable {
  __type: 'effect';
  _callback(): void | (() => void);
  dispose(): void;
  subscribe?: (listener: () => void) => () => void;
}

export type EffectCleanup = void | (() => void);
export type Unsubscribe = () => void;

// Dispose function with attached effect instance
export interface EffectDisposer {
  (): void;
  __effect: EffectInterface;
}


const {
  RUNNING,
  DISPOSED,
  OUTDATED,
  NOTIFIED,
} = CONSTANTS;

// OPTIMIZATION: Shared Dispose Function
// Instead of creating a new bound function for each effect, we share one
// function and bind it to different effect instances. This reduces memory
// allocation and GC pressure in applications with many effects.
const genericDispose = function(this: EffectInterface) { 
  this.dispose(); 
};

interface EffectFactoryContext extends SignalContext {
  dependencies: DependencyGraph;
  sourceCleanup: DependencySweeper;
}

export function createEffectFactory(ctx: EffectFactoryContext): LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer> {
  const {
    dependencies: { needsRecompute }
  } = ctx;

  // Source cleanup for dynamic dependencies
  const { detachAll, pruneStale } = ctx.sourceCleanup;
  class Effect implements EffectInterface {
    // OPTIMIZATION: Hot/Cold Field Separation
    // Group frequently accessed fields together for better CPU cache locality
    
    // Hot fields (accessed on every schedule/flush cycle)
    _flags = OUTDATED;                                   // Start OUTDATED to run on creation
    _sources: Edge | undefined = undefined;              // Dependencies this effect reads
    _nextScheduled: ScheduledNode | undefined = undefined; // Link in scheduling queue
    // Generation counter for dynamic dependency pruning
    _gen = 0;
    
    // Cold fields (accessed less frequently)
    __type = 'effect' as const;                          // Type discriminator
    _callback: () => void | (() => void);                // User's effect function
    _cleanup: (() => void) | undefined = undefined;      // Cleanup from previous run
    
    // OPTIMIZATION: Last Verified Global Version
    // Cache the global ctx.version when we've verified that dependencies
    // did NOT change. If another NOTIFIED arrives without a global version
    // bump, we can skip shouldNodeUpdate() entirely and clear NOTIFIED.
    _verifiedVersion = -1;

    constructor(fn: () => void | (() => void)) {
      this._callback = fn;
    }

    _invalidate(): void {
      // ALGORITHM: Effect Invalidation with Linked List Queue
      // Effects are queued using intrusive linked list
      // The NOTIFIED flag prevents duplicate scheduling
      
      // Early exit if already processed
      if (this._flags & NOTIFIED) return;
      
      // Mark as NOTIFIED
      this._flags |= NOTIFIED;
      
      // Queue the effect if not already queued
      if (this._nextScheduled === undefined) {
        // Use sentinel value to mark as queued
        this._nextScheduled = this;
        if (ctx.queueTail) {
          ctx.queueTail._nextScheduled = this;
          ctx.queueTail = this;
        } else {
          ctx.queueHead = ctx.queueTail = this;
        }
      }
      
      // If not in a batch, flush immediately
      if (ctx.batchDepth === 0) {
        let current = ctx.queueHead;
        ctx.queueHead = ctx.queueTail = undefined;
        
        while (current) {
          const next = current._nextScheduled === current ? undefined : current._nextScheduled;
          current._nextScheduled = undefined;
          current._flush();
          current = next;
        }
      }
    }

    _flush(): void {
      // OPTIMIZATION: Early Exit Checks
      // Skip if disposed (dead node) or already running (prevent re-entrance)
      if (this._flags & (DISPOSED | RUNNING)) return;

      // OPTIMIZATION: Check if effect needs to run
      // Skip if not marked as OUTDATED or NOTIFIED
      if (!(this._flags & (OUTDATED | NOTIFIED))) return;
      
      // If only NOTIFIED (not OUTDATED), check if dependencies actually changed
      if (!(this._flags & OUTDATED)) {
        // FAST PATH: If we've already verified no change at this global version,
        // clear NOTIFIED and bail without rechecking dependencies.
        if (this._verifiedVersion === ctx.version) {
          this._flags &= ~NOTIFIED;
          return;
        }
        
        // Slow path: perform dependency check
        if (!needsRecompute(this)) {
          // Cache the verified clean global version to skip future checks
          this._verifiedVersion = ctx.version;
          return;
        }
        // If dirty, shouldNodeUpdate marked OUTDATED; fall through to run
      }

      // ALGORITHM: Atomic State Transition
      // Set RUNNING to prevent re-entrance
      // Clear NOTIFIED and OUTDATED since we're handling them now
      this._flags = (this._flags | RUNNING) & ~(NOTIFIED | OUTDATED);

      // Bump generation for this run; dependencies touched will be tagged
      this._gen = (this._gen + 1) | 0;

      // ALGORITHM: Context Management for Dependency Tracking
      // Set ourselves as current consumer so signal/computed reads register with us
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;

      try {

        // ALGORITHM: Cleanup Before Re-execution
        // If the effect returned a cleanup function last time, run it first
        // This ensures proper resource cleanup (event listeners, timers, etc)
        if (this._cleanup) {
          this._cleanup();
          this._cleanup = undefined;
        }
        
        // ALGORITHM: Execute Effect with Optional Cleanup Return
        // The effect can return a cleanup function that will be called:
        // 1. Before the next execution
        // 2. When the effect is disposed
        const result = this._callback();
        if (result) {
          this._cleanup = result;
        }
      } finally {
        // ALGORITHM: Cleanup Phase (must run even if effect throws)
        // 1. Restore previous consumer context
        ctx.currentConsumer = prevConsumer;
        
        // 2. Clear RUNNING flag to allow future executions
        this._flags &= ~RUNNING;
        
        // 3. Remove stale dependencies (dynamic dependency tracking)
        pruneStale(this);
      }
    }

    _refresh(): boolean {
      // Effects are always considered "fresh" - they don't produce values
      // This method exists to satisfy the ConsumerNode interface
      // Effects are scheduled for execution through _invalidate/_flush instead
      return true;
    }

    dispose(): void {
      // ALGORITHM: Effect Disposal
      // 1. Mark as disposed and run any pending cleanup
      if (this._flags & DISPOSED) return;
      this._flags |= DISPOSED;
      
      if (this._cleanup) {
        this._cleanup();
        this._cleanup = undefined;
      }
      
      // 2. Remove all dependency edges for garbage collection
      detachAll(this);
      
      // TODO: Should we also clear _callback to free closure memory?
    }
  }

  return {
    name: 'effect',
    method: function effect(effectFn: () => void | (() => void)): EffectDisposer {
      const e = new Effect(effectFn);
      
      // ALGORITHM: Immediate Execution
      // Effects run immediately when created to establish initial state
      // and dependencies. This matches user expectations from React useEffect.
      e._flush();

      // OPTIMIZATION: Reuse Generic Dispose Function
      // Bind the shared dispose function to this effect instance
      const dispose = genericDispose.bind(e) as EffectDisposer;
      
      // Attach effect instance for debugging/testing
      dispose.__effect = e;

      return dispose;
    }
  };
}
