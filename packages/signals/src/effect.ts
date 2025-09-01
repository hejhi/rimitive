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

import { CONSTANTS, createFlagManager } from './constants';
import { Disposable, Edge, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { SignalContext } from './context';

export interface EffectInterface extends ScheduledNode, Disposable {
  __type: 'effect';
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
  STATUS_CLEAN,
  STATUS_DIRTY,
  STATUS_DISPOSED,
} = CONSTANTS;

const { getStatus, setStatus } = createFlagManager();

interface EffectFactoryContext extends SignalContext {
  graph: DependencyGraph;
}

export function createEffectFactory(ctx: EffectFactoryContext): LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer> {
  const {
    graph: { detachAll, pruneStale },
  } = ctx;
  
  // CLOSURE PATTERN: Create effect with closure-captured state for better V8 optimization
  function createEffect(fn: () => void | (() => void)): EffectDisposer {
    // State object captured in closure - no binding needed
    const effect: EffectInterface = {
      __type: 'effect' as const,
      _flags: STATUS_DIRTY,  // Start in DIRTY state to trigger initial execution
      _in: undefined as Edge | undefined,
      _inTail: undefined as Edge | undefined,
      _nextScheduled: undefined as ScheduledNode | undefined,
      _cleanup: undefined as (() => void) | undefined,
      // These will be set below
      dispose: null as unknown as () => void,
      _flush: null as unknown as () => void,
    };

    // Flush method using closure
    const flush = (): void => {
      effect._inTail = undefined;

      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = effect;

      try {
        // Run cleanup if exists (optimized to avoid double read)
        const cleanup = effect._cleanup;
        if (cleanup) {
          effect._cleanup = undefined;
          cleanup();
        }

        // Main effect execution and store new cleanup
        const newCleanup = fn();
        if (newCleanup) effect._cleanup = newCleanup;
      } finally {
        ctx.currentConsumer = prevConsumer;
        // Transition back to clean state after execution
        effect._flags = setStatus(effect._flags, STATUS_CLEAN);
        pruneStale(effect);
      }
    };

    // Dispose method using closure
    const dispose = (): void => {
      // Fast exit if already disposed
      if (getStatus(effect._flags) === STATUS_DISPOSED) return;
      
      // Transition to disposed state to prevent re-entrance
      effect._flags = setStatus(effect._flags, STATUS_DISPOSED);

      // Run cleanup if exists
      const cleanup = effect._cleanup;

      if (cleanup) {
        effect._cleanup = undefined;  // Clear to prevent double cleanup
        cleanup();
      }
      
      detachAll(effect);
    };

    // Set methods
    effect._flush = flush;
    effect.dispose = dispose;

    // Effects run immediately when created to establish initial state and dependencies.
    flush();

    return dispose;
  }

  return {
    name: 'effect',
    method: createEffect
  }
}
