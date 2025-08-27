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


const { RUNNING, DISPOSED, DIRTY, INVALIDATED } = CONSTANTS;

const UPDATE = DIRTY | INVALIDATED;

interface EffectFactoryContext extends SignalContext {
  graph: DependencyGraph;
}

export function createEffectFactory(ctx: EffectFactoryContext): LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer> {
  const {
    graph: { detachAll, pruneStale, isStale },
  } = ctx;
  
  // CLOSURE PATTERN: Create effect with closure-captured state for better V8 optimization
  function createEffect(fn: () => void | (() => void)): EffectDisposer {
    // State object captured in closure - no binding needed
    const effect: EffectInterface = {
      __type: 'effect' as const,
      _flags: DIRTY,
      _in: undefined as Edge | undefined,
      _inTail: undefined as Edge | undefined,
      _nextScheduled: undefined as ScheduledNode | undefined,
      _callback: fn,
      _cleanup: undefined as (() => void) | undefined,
      // These will be set below
      dispose: null as unknown as () => void,
      _flush: null as unknown as () => void,
    };

    // Flush method using closure
    const flushEffect = (): void => {
      const flags = effect._flags;

      // Single bitwise check for fast exit
      if (flags & (DISPOSED | RUNNING)) return;
      
      // Fast exit if not marked for update
      const updateFlags = flags & UPDATE;
      if (!updateFlags) return;

      // Check if actually needs to run
      // Only INVALIDATED, need to check if actually stale
      if (!(flags & DIRTY) && !isStale(effect)) {
        effect._flags &= ~INVALIDATED;
        return;
      }

      // Combine bitwise mutations in a single assignment
      effect._flags = (flags | RUNNING) & ~UPDATE;
      effect._inTail = undefined;

      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = effect;

      try {
        // Run cleanup if exists
        if (effect._cleanup) {
          effect._cleanup();
          effect._cleanup = undefined;
        }

        // Main effect execution and store new cleanup
        effect._cleanup = effect._callback() || undefined;
      } finally {
        ctx.currentConsumer = prevConsumer;
        effect._flags &= ~RUNNING;
        pruneStale(effect);
      }
    };

    // Dispose method using closure
    const dispose = (): void => {
      if (effect._flags & DISPOSED) return;
      
      // Mark as disposed first to prevent re-entrance
      effect._flags = DISPOSED;

      // Run cleanup and detach in one go
      const cleanup = effect._cleanup;
      if (cleanup) cleanup();
      
      detachAll(effect);
    };

    // Set methods
    effect._flush = flushEffect;
    effect.dispose = dispose;

    // Effects run immediately when created to establish initial state and dependencies.
    flushEffect();

    return dispose;
  }

  return {
    name: 'effect',
    method: createEffect
  }
}
