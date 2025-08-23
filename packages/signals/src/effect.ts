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
}

export type EffectCleanup = void | (() => void);
export type Unsubscribe = () => void;

// Dispose function with attached effect instance
export interface EffectDisposer {
  (): void;
}


const {
  RUNNING,
  DISPOSED,
  STALE,
  INVALIDATED,
  PENDING,
} = CONSTANTS;

// Note: genericDispose removed - we now use closures instead of bind

interface EffectFactoryContext extends SignalContext {
  graph: DependencyGraph;
  sourceCleanup: DependencySweeper;
}

export function createEffectFactory(ctx: EffectFactoryContext): LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer> {
  const {
    graph: { nodeIsStale },
  } = ctx;

  // Source cleanup for dynamic dependencies
  const { detachAll, pruneStale } = ctx.sourceCleanup;
  
  // CLOSURE PATTERN: Create effect with closure-captured state for better V8 optimization
  function createEffect(fn: () => void | (() => void)): EffectDisposer {
    // State object captured in closure - no binding needed
    const effect: EffectInterface = {
      __type: 'effect' as const,
      _flags: STALE,
      _in: undefined as Edge | undefined,
      _inTail: undefined as Edge | undefined,
      _nextScheduled: undefined as ScheduledNode | undefined,
      _callback: fn,
      _cleanup: undefined as (() => void) | undefined,
      // These will be set below
      dispose: null as unknown as () => void,
      _flush: null as unknown as () => void,
      _recompute: null as unknown as () => boolean,
    };

    // Flush method using closure
    const flushEffect = (): void => {
      const flags = effect._flags;
      
      // Early exit: disposed, running, or not pending
      if (flags & (DISPOSED | RUNNING) || !(flags & PENDING)) return;

      // If only INVALIDATED (not STALE), check if dependencies actually changed
      if (!(flags & STALE) && !nodeIsStale(effect)) {
        // Dependencies haven't changed, clear invalidated flag
        effect._flags &= ~INVALIDATED;
        return;
      }

      // ALGORITHM: Atomic State Transition
      // Set RUNNING to prevent re-entrance
      // Clear all flags since we're handling them now
      effect._flags = (effect._flags | RUNNING) & ~PENDING;

      // ALGORITHM: Increment tracking version for this effect run
      // This marks the start of a new tracking context
      ctx.trackingVersion++;

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
    };

    // UpdateValue method using closure
    const recompute = (): boolean => {
      // Effects don't produce values - nothing to update
      // This method exists to satisfy the ConsumerNode interface
      return true;
    };

    // Dispose method using closure
    const dispose = (): void => {
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
    };

    // Set methods
    effect._flush = flushEffect;
    effect._recompute = recompute;
    effect.dispose = dispose;

    // Effects run immediately when created to establish initial state
    // and dependencies.
    flushEffect();

    return dispose;
  }

  return {
    name: 'effect',
    method: createEffect
  }
}
