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
    graph: { needsFlush },
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
    };

    // Flush method using closure
    const flushEffect = (): void => {
      const flags = effect._flags;

      // Single bitwise check for fast exit
      if (flags & (DISPOSED | RUNNING) || !(flags & PENDING)) return;

      // Check dependencies only if needed
      if (!(flags & STALE) && !needsFlush(effect)) {
        effect._flags &= ~INVALIDATED;
        return;
      }

      // Combine bitwise mutations in a single assignment
      effect._flags = (flags | RUNNING) & ~PENDING;

      ctx.trackingVersion++;
      effect._inTail = undefined;

      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = effect;

      try {
        // Fast path: cleanup function
        const cleanup = effect._cleanup;
        if (cleanup) {
          cleanup();
          effect._cleanup = undefined;
        }

        // Main effect execution
        const res = effect._callback();
        if (res) effect._cleanup = res;
      } finally {
        ctx.currentConsumer = prevConsumer;
        effect._flags &= ~RUNNING;
        pruneStale(effect);
      }
    };

    // Dispose method using closure
    const dispose = (): void => {
      if (effect._flags & DISPOSED) return;
      effect._flags |= DISPOSED;

      if (effect._cleanup) {
        effect._cleanup();
        effect._cleanup = undefined;
      }

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
