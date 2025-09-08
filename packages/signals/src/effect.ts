import { ConsumerNode, Dependency, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { GlobalContext } from './context';
import { NodeScheduler } from './helpers/node-scheduler';
import { GraphEdges } from './helpers/graph-edges';

export type EffectContext = GlobalContext & {
  nodeScheduler: NodeScheduler;
  graphEdges: GraphEdges;
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

export function createEffectFactory(
  ctx: EffectContext
): LatticeExtension<
  'effect',
  (fn: () => void | (() => void)) => EffectDisposer
> {
  const {
    nodeScheduler: { dispose: disposeNode, enqueue },
    graphEdges: { startTracking, endTracking, detachAll }
  } = ctx;

  // CLOSURE PATTERN: Create effect with closure-captured state for better V8 optimization
  function createEffect(fn: () => void | (() => void)): EffectDisposer {
    // State object captured in closure - no binding needed
    const node: EffectInterface = {
      __type: 'effect' as const,
      _cleanup: undefined as (() => void) | undefined,
      flags: 0,
      dependencies: undefined as Dependency | undefined,
      dependencyTail: undefined as Dependency | undefined,
      nextScheduled: undefined as ScheduledNode | undefined,
      notify: enqueue as (node: ConsumerNode) => void, // Store the enqueue function directly for fast access
      // This will be set below
      flush: null as unknown as () => void,
    };

    // Flush method using closure
    const flush = (): void => {
      const prevConsumer = startTracking(ctx, node);

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
        endTracking(ctx, node, prevConsumer);
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
