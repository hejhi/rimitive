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
 *    - INVALIDATED flag prevents duplicate scheduling
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
  _cleanup: (() => void) | undefined; // Cleanup from previous run
  _verifiedVersion: number; // Cached global version for optimization
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
  STALE,
  INVALIDATED,
  PENDING,
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
    dependencies: { refreshConsumers },
  } = ctx;

  // Source cleanup for dynamic dependencies
  const { detachAll, pruneStale } = ctx.sourceCleanup;
  
  // PATTERN: Closure-based Factory with Bound Methods (Alien Signals approach)
  // Using factory functions with bound methods attached to plain objects:
  // - No prototype chain, methods are directly on the object
  // - Closures capture context instead of using 'this'
  // - Plain objects instead of class instances
  function createEffect(fn: () => void | (() => void)): EffectInterface {
    // Create plain object to hold the effect data
    const effect: EffectInterface = {
      __type: 'effect' as const,
      _flags: STALE,
      _in: undefined as Edge | undefined,
      _inTail: undefined as Edge | undefined,
      _nextScheduled: undefined as ScheduledNode | undefined,
      _callback: fn,
      _cleanup: undefined as (() => void) | undefined,
      _verifiedVersion: -1,
      // These will be added by bind methods below
      dispose: null as unknown as (() => void),
      _flush: null as unknown as (() => void),
      _updateValue: null as unknown as (() => boolean),
    };

    // ALGORITHM: Bound Flush Method
    function flushEffect(this: EffectInterface): void {
      // OPTIMIZATION: Early Exit Checks
      // Skip if disposed (dead node) or already running (prevent re-entrance)
      if (effect._flags & (DISPOSED | RUNNING)) return;

      // OPTIMIZATION: Check if effect needs to run
      // Skip if not marked as PENDING (a compound flag)
      if (!(effect._flags & PENDING)) return;

      // If only INVALIDATED (not STALE), check if dependencies actually changed
      if (!(effect._flags & STALE)) {
        // FAST PATH: If we've already verified no change at this global version,
        // clear INVALIDATED and bail without rechecking dependencies.
        if (effect._verifiedVersion === ctx.version) {
          effect._flags &= ~INVALIDATED;
          return;
        }

        // Slow path: perform dependency check
        if (!refreshConsumers(effect)) {
          // Cache the verified clean global version to skip future checks
          effect._verifiedVersion = ctx.version;
          return;
        }

        // If stale, refreshConsumers marked STALE; fall through to run
      }

      // ALGORITHM: Atomic State Transition
      // Set RUNNING to prevent re-entrance
      // Clear all flags since we're handling them now
      effect._flags = (effect._flags | RUNNING) & ~PENDING;

      // ALGORITHM: Tail-based Dependency Tracking (alien-signals approach)
      // Reset tail to undefined at start - all edges after this will be removed
      effect._inTail = undefined;

      // ALGORITHM: Context Management for Dependency Tracking
      // Set ourselves as current consumer so signal/computed reads register with us
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = effect;

      try {
        // ALGORITHM: Cleanup Before Re-execution
        // If the effect returned a cleanup function last time, run it first
        // This ensures proper resource cleanup (event listeners, timers, etc)
        if (effect._cleanup) {
          effect._cleanup();
          effect._cleanup = undefined;
        }

        // ALGORITHM: Execute Effect with Optional Cleanup Return
        // The effect can return a cleanup function that will be called:
        // 1. Before the next execution
        // 2. When the effect is disposed
        const result = effect._callback();
        if (result) {
          effect._cleanup = result;
        }
      } finally {
        // ALGORITHM: Cleanup Phase (must run even if effect throws)
        // 1. Restore previous consumer context
        ctx.currentConsumer = prevConsumer;

        // 2. Clear RUNNING flag to allow future executions
        effect._flags &= ~RUNNING;

        // 3. Remove stale dependencies (dynamic dependency tracking)
        pruneStale(effect);
      }
    }

    // ALGORITHM: Bound UpdateValue Method
    function updateValue(): boolean {
      // Effects don't produce values - nothing to update
      // This method exists to satisfy the ConsumerNode interface
      return true;
    }

    // ALGORITHM: Bound Dispose Method
    function dispose(): void {
      // ALGORITHM: Effect Disposal
      // 1. Mark as disposed and run any pending cleanup
      if (effect._flags & DISPOSED) return;
      effect._flags |= DISPOSED;

      if (effect._cleanup) {
        effect._cleanup();
        effect._cleanup = undefined;
      }

      // 2. Remove all dependency edges for garbage collection
      detachAll(effect);

      // TODO: Should we also clear _callback to free closure memory?
    }

    effect._flush = flushEffect.bind(effect);
    effect._updateValue = updateValue.bind(effect);
    effect.dispose = dispose.bind(effect);

    return effect;
  }

  return {
    name: 'effect',
    method: function effect(effectFn: () => void | (() => void)): EffectDisposer {
      const e = createEffect(effectFn);
      
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
