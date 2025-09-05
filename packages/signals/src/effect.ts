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
import { ConsumerNode, Dependency, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { GlobalContext } from './context';
import { GraphEdges } from './helpers/graph-edges';
import { NodeScheduler } from './helpers/node-scheduler';

export type EffectContext = GlobalContext & {
  graphEdges: GraphEdges;
  nodeScheduler: NodeScheduler;
};

export interface EffectInterface extends ScheduledNode {
  __type: 'effect';
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
} = CONSTANTS;

const { setStatus } = createFlagManager();

export function createEffectFactory(
  ctx: GlobalContext & EffectContext
): LatticeExtension<
  'effect',
  (fn: () => void | (() => void)) => EffectDisposer
> {
  const {
    graphEdges: { detachAll, pruneStale },
    nodeScheduler: { dispose: disposeNode, enqueue },
  } = ctx;

  // CLOSURE PATTERN: Create effect with closure-captured state for better V8 optimization
  function createEffect(fn: () => void | (() => void)): EffectDisposer {
    // State object captured in closure - no binding needed
    const node: EffectInterface = {
      __type: 'effect' as const,
      _cleanup: undefined as (() => void) | undefined,
      flags: STATUS_DIRTY, // Start in DIRTY state to trigger initial execution
      dependencies: undefined as Dependency | undefined,
      dependencyTail: undefined as Dependency | undefined,
      nextScheduled: undefined as ScheduledNode | undefined,
      notify: enqueue as (node: ConsumerNode) => void, // Store the enqueue function directly for fast access
      // This will be set below
      flush: null as unknown as () => void,
    };

    // Flush method using closure
    const flush = (): void => {
      // Only increment tracking version if we're starting a new top-level tracking cycle
      // If currentConsumer is not null, we're already inside a tracking cycle
      if (!ctx.currentConsumer) {
        ctx.trackingVersion++;
      }
      
      node.dependencyTail = undefined;

      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = node;

      try {
        // Run cleanup if exists (optimized to avoid double read)
        const cleanup = node._cleanup;
        if (cleanup) {
          node._cleanup = undefined;
          cleanup();
        }

        // Main state execution and store new cleanup
        const newCleanup = fn();
        if (newCleanup) node._cleanup = newCleanup;
      } finally {
        ctx.currentConsumer = prevConsumer;
        // Transition back to clean state after execution
        node.flags = setStatus(node.flags, STATUS_CLEAN);
        pruneStale(node);
      }
    };

    // Dispose method using closure - delegates flag management to nodeScheduler
    const dispose = (): void => {
      disposeNode(node, (node) => {
        // Effect-specific cleanup
        const cleanup = node._cleanup;
        if (cleanup) {
          node._cleanup = undefined; // Clear to prevent double cleanup
          cleanup();
        }
        detachAll(node);
      });
    };

    // Set flush method
    node.flush = flush;

    // Effects run immediately when created to establish initial state and dependencies.
    // This flushes outside of the scheduling mechanism.
    flush();

    return dispose;
  }

  return {
    name: 'effect',
    method: createEffect,
  };
}
