import { Dependency, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { GlobalContext } from './context';
import { NodeScheduler } from './helpers/node-scheduler';
import { GraphEdges } from './helpers/graph-edges';
import { CONSTANTS } from './constants';

const { STATUS_CLEAN } = CONSTANTS;

export type EffectOpts = {
  ctx: GlobalContext;
  nodeScheduler: NodeScheduler;
  graphEdges: GraphEdges;
};

interface EffectNode extends ScheduledNode {
  __type: 'effect';
  subscribe?: (listener: () => void) => () => void;
  _cleanup: (() => void) | undefined; // Cleanup from previous run
}

// Dispose function with attached effect instance
export interface EffectDisposer {
  (): void;
}

export function createEffectFactory(
  opts: EffectOpts
): LatticeExtension<
  'effect',
  (fn: () => void | (() => void)) => EffectDisposer
> {
  const {
    ctx,
    nodeScheduler: { dispose: disposeNode, enqueue },
    graphEdges: { startTracking, endTracking, detachAll },
  } = opts;

  function createEffect(fn: () => void | (() => void)): EffectDisposer {
    const flush = (node: EffectNode): void => {
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
    }

    const schedule = (node: ScheduledNode) => {
      if (enqueue(node)) return;
      flush(node as EffectNode);
    }

    // State object captured in closure - no binding needed
    const node: EffectNode = {
      __type: 'effect' as const,
      _cleanup: undefined as (() => void) | undefined,
      status: STATUS_CLEAN,
      dependencies: undefined as Dependency | undefined,
      dependencyTail: undefined as Dependency | undefined,
      deferredParent: undefined,
      nextScheduled: undefined as ScheduledNode | undefined,
      schedule,
      flush,
    };

    // Dispose method using closure - delegates flag management to nodeScheduler
    const dispose = (): void => disposeNode(node, (node) => {
      // Effect-specific cleanup
      const cleanup = node._cleanup;

      if (cleanup) {
        node._cleanup = undefined; // Clear to prevent double cleanup
        cleanup();
      }
      detachAll(node);
    });

    // Effects run immediately when created to establish initial state and dependencies.
    // This flushes outside of the scheduling mechanism.
    flush(node);

    return dispose;
  }

  return {
    name: 'effect',
    method: createEffect,
  };
}
